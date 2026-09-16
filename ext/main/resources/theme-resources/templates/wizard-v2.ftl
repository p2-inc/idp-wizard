<!doctype html>
<html lang="en-US">

<head>
  <meta charset="utf-8" />
  <title>${realmName} - Add Identity Provider</title>
  <meta id="appName" name="application-name" content="${realmName} - Add Identity Provider" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <base href="${relativePath}/realms/${realmName}/wizard/" />
  <link rel="icon" type="image/svg+xml" href="${wizardResources}/phasetwo-logos/phasetwo_logo_icon.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="${wizardResources}/favicons/apple-touch-icon.png" />
  <meta name="theme-color" content="#ffffff" />
  <!-- Wizard definitions reference screenshots by root-relative path; this tells the app
       where this version's static files actually live. -->
  <meta name="wizard-asset-base" content="${wizardResources}/" />
  <script>
    // Applies the stored theme before first paint to avoid a flash of the wrong theme.
    (function () {
      try {
        var t = localStorage.getItem("wizard-theme") || "system";
        var dark =
          t === "dark" ||
          (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (dark) document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
      } catch (e) {}
    })();
  </script>
  <script type="module" crossorigin src="${wizardResources}/main.js"></script>
  <link href="${wizardResources}/main.css" rel="stylesheet" />
</head>

<body>
  <noscript>Enabling JavaScript is required to run this app.</noscript>
  <div id="root"></div>
</body>

</html>
