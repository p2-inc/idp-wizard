package io.phasetwo.wizard;

import com.google.common.collect.ImmutableMap;
import jakarta.activation.MimetypesFileTypeMap;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.OPTIONS;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.PathSegment;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.forms.login.freemarker.FreeMarkerLoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.services.cors.Cors;
import org.keycloak.services.resource.RealmResourceProvider;
import org.keycloak.theme.Theme;

@JBossLog
public class WizardResourceProvider implements RealmResourceProvider {

  private final KeycloakSession session;
  private final String authRealmOverride;
  private final String version;

  public WizardResourceProvider(KeycloakSession session, String authRealmOverride, String version) {
    this.session = session;
    this.authRealmOverride = authRealmOverride;
    this.version = version;
  }

  @Override
  public Object getResource() {
    return this;
  }

  private void setupCors() {
    Cors.builder().allowAllOrigins().allowedMethods(METHODS).auth().add();
  }

  public static final String[] METHODS = {
    "GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
  };

  /**
   * Static assets live under a per-version directory in the theme's resources, so one prefix match
   * covers every bundler output shape. Anything else falls through to the SPA shell, which is what
   * client-side routes need.
   */
  private static final Pattern STATIC_RESOURCE_PATH = Pattern.compile("^v[12]/.*");

  @OPTIONS
  @Path("{any:.*}")
  public Response preflight() {
    log.trace("CORS OPTIONS preflight request");
    return Cors.builder().auth().allowedMethods(METHODS).preflight().add(Response.ok());
  }

  private static Optional<String> getPathSegments(URI uri) {
    if (uri == null) {
      return Optional.empty();
    }

    String path = uri.getPath();
    if (path == null || path.isBlank() || path.equals("/")) {
      return Optional.empty();
    }

    // Normalize: remove leading/trailing slashes and split
    String cleaned =
        Arrays.stream(path.split("/"))
            .filter(segment -> !segment.isBlank())
            .collect(Collectors.joining("/"));

    if (cleaned.isEmpty()) {
      return Optional.empty();
    }

    return Optional.of("/" + cleaned);
  }

  /**
   * something is seriously wrong since resteasy reactive upgrade. catch-all and regex paths no
   * longer work from annotations. This is a hack to get v23 working in the meantime.
   */
  @GET
  @Path("{path:.+}")
  public Response router(@PathParam("path") String path) throws Exception {
    UriInfo uriInfo = session.getContext().getUri();
    log.tracef("param path %s", path);
    log.tracef("absolutePath %s", uriInfo.getAbsolutePath());
    log.tracef("path %s", uriInfo.getPath());
    log.tracef("baseUri %s", uriInfo.getBaseUri());
    log.tracef("segments %s", uriInfo.getPathSegments());
    log.tracef("requestUri %s", uriInfo.getRequestUri());
    log.tracef("relativePath %s", getPathSegments(uriInfo.getBaseUri()).orElse("<empty>"));

    if (path == null || "".equals(path) || "/".equals(path)) return wizard();

    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    if (STATIC_RESOURCE_PATH.matcher(path).matches()) {
      Response response = staticResources(path);
      if (response != null) {
        log.tracef("returning response %d for path %s", response.getStatus(), path);
        return response;
      }
    }

    return wizard();
  }

  @GET
  @Produces(MediaType.TEXT_HTML)
  public Response wizard() {
    log.tracef("wizard index file (version %s)", version);
    UriInfo uriInfo = session.getContext().getUri();
    String relativePath = getPathSegments(uriInfo.getBaseUri()).orElse("");
    // Assets are served from a per-version subdirectory; the template resolves this
    // against its own <base href>.
    String wizardResources = "./" + version;
    Theme theme = getTheme("wizard");
    RealmModel realm = session.getContext().getRealm();
    LoginFormsProvider form =
        session
            .getProvider(LoginFormsProvider.class)
            .setAttribute("relativePath", relativePath)
            .setAttribute("wizardResources", wizardResources)
            .setAttribute("realmName", realm.getName());
    FreeMarkerLoginFormsProvider fm = (FreeMarkerLoginFormsProvider) form;
    try {
      Method processTemplateMethod = getProcessTemplateMethod(fm);
      processTemplateMethod.setAccessible(true);
      Response resp =
          (Response)
              processTemplateMethod.invoke(
                  fm, theme, templateName(), session.getContext().resolveLocale(null));
      return resp;
    } catch (Exception e) {
      log.warn("Could not call processTemplate on FreeMarkerLoginFormsProvider", e);
    }
    return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
  }

  /** Each frontend has its own template — they reference different bundle filenames. */
  private String templateName() {
    return WizardResourceProviderFactory.VERSION_V2.equals(version)
        ? "wizard-v2.ftl"
        : "wizard.ftl";
  }

  Method getProcessTemplateMethod(FreeMarkerLoginFormsProvider provider)
      throws NoSuchMethodException {
    Class<?> clazz = provider.getClass();
    StringBuilder o = new StringBuilder();
    while (clazz != null) {
      o.append(clazz.getSimpleName()).append("->");
      try {
        Method method =
            clazz.getDeclaredMethod("processTemplate", Theme.class, String.class, Locale.class);
        return method;
      } catch (NoSuchMethodException ignore) {
      }
      clazz = clazz.getSuperclass();
    }
    throw new NoSuchMethodException(
        String.format("Unable to find processTemplate method in hierarchy %s", o.toString()));
  }

  @GET
  @Path("{path:^v[12]/.*}")
  public Response staticResources(@PathParam("path") final String path) throws IOException {
    log.trace("static resources");
    String fileName = getLastPathSegment(session.getContext().getUri());
    Theme theme = getTheme("wizard");
    InputStream resource = theme.getResourceAsStream(path);
    String mimeType = getMimeType(fileName);
    log.tracef("%s [%s] (%s)", path, mimeType, null == resource ? "404" : "200");
    return null == resource
        ? Response.status(Response.Status.NOT_FOUND).build()
        : Response.ok(resource, mimeType).build();
  }

  @GET
  @Path("keycloak.json")
  @Produces(MediaType.APPLICATION_JSON)
  public Response keycloakJson() {
    log.trace("keycloak.json");
    setupCors();
    RealmModel realm = session.getContext().getRealm();
    UriInfo uriInfo = session.getContext().getUri();
    Map json =
        ImmutableMap.of(
            "realm",
            authRealmOverride,
            "auth-server-url",
            getBaseUrl(uriInfo),
            "resource",
            "idp-wizard");
    return Response.ok(json).build();
  }

  @GET
  @Path("config.json")
  @Produces(MediaType.APPLICATION_JSON)
  public WizardConfig configJson() {
    log.trace("config.json");
    setupCors();
    return WizardConfig.createFromAttributes(session);
  }

  private static String getBaseUrl(UriInfo uriInfo) {
    String u = uriInfo.getBaseUri().toString();
    if (u != null && u.endsWith("/")) u = u.substring(0, u.length() - 1);
    return u;
  }

  private static String getOrigin(UriInfo uriInfo) {
    return uriInfo.getBaseUri().resolve("/").toString();
  }

  private Theme getTheme(String name) {
    try {
      return session.theme().getTheme(name, Theme.Type.LOGIN);
    } catch (IOException e) {
      throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  private String getLastPathSegment(UriInfo uriInfo) {
    List<PathSegment> segs = uriInfo.getPathSegments();
    if (segs != null && segs.size() > 0) {
      return segs.get(segs.size() - 1).getPath();
    }
    return null;
  }

  private static final String MIME_TYPES =
      "text/javascript js\n"
          + "text/css css\n"
          + "font/woff woff\n"
          + "font/woff2 woff2\n"
          + "application/json json webmanifest map\n"
          + "image/svg+xml svg\n";

  private String getMimeType(String fileName) {
    MimetypesFileTypeMap map = new MimetypesFileTypeMap();
    map.addMimeTypes(MIME_TYPES); // loading from mime.types on classpath not working
    return map.getContentType(fileName);
  }

  @Override
  public void close() {}
}
