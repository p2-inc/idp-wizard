import React, { FC, useState } from "react";
import { useFormik } from "formik";
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormAlert,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
} from "@patternfly/react-core";
import * as Yup from "yup";
import {
  API_RETURN,
  API_RETURN_PROMISE,
  API_STATUS,
} from "@app/configurations/api-status";

const ServerConfigSchema = Yup.object().shape({
  host: Yup.string().required("LDAP host is a required field."),
  sslPort: Yup.string().required("LDAP SSL Port is required."),
  baseDn: Yup.string().required("LDAP Base DN is required."),
  userBaseDn: Yup.string().required("LDAP User Base DN is required."),
  groupBaseDn: Yup.string().required("LDAP Group Base DN is required."),
  userFilter: Yup.string(),
  groupFilter: Yup.string(),
});

export type ServerConfig = {
  host: string;
  sslPort: string;
  baseDn: string;
  userBaseDn: string;
  groupBaseDn: string;
  userFilter?: string;
  groupFilter?: string;
};

type Props = {
  handleFormSubmit: ({
    host,
    sslPort,
    baseDn,
    userBaseDn,
    groupBaseDn,
    userFilter,
    groupFilter,
  }: ServerConfig) => API_RETURN_PROMISE;
  formActive?: boolean;
  config: ServerConfig;
  enableFilters?: boolean;
};

export const LdapServerConfig: FC<Props> = ({
  handleFormSubmit,
  config,
  formActive = true,
  enableFilters = false,
}) => {
  const [submissionResp, setSubmissionResp] = useState<API_RETURN | null>();

  const {
    handleSubmit,
    handleChange,
    values,
    errors,
    touched,
    isSubmitting,
    setSubmitting,
    setFieldValue,
  } = useFormik({
    initialValues: {
      host: config.host || "",
      sslPort: config.sslPort || "",
      baseDn: config.baseDn || "",
      userBaseDn: config.userBaseDn || "",
      groupBaseDn: config.groupBaseDn || "",
      userFilter: config.userFilter || "",
      groupFilter: config.groupFilter || "",
    },
    onSubmit: async (values) => {
      const resp = await handleFormSubmit(values);
      setSubmissionResp(resp);
      setSubmitting(false);
    },
    validationSchema: ServerConfigSchema,
  });

  const handleHostChange = (val, e) => {
    handleChange(e);
    autofillValues(val);
  };

  const handleBlur = () => {
    const { host } = values;
    autofillValues(host);
  };

  const autofillValues = (host) => {
    if (host.match(/\w+\.ldap\.okta\.com/gi)) {
      const splitHost = host.split(".");
      const custId = splitHost[0];
      setFieldValue("sslPort", "636");
      setFieldValue("baseDn", `dc=${custId}, dc=okta, dc=com`);
      setFieldValue("userBaseDn", `ou=users, dc=${custId}, dc=okta, dc=com`);
      setFieldValue("groupBaseDn", `ou=groups, dc=${custId}, dc=okta, dc=com`);
    }
  };

  const hasError = (key: string) =>
    errors[key] && touched[key] ? "error" : "default";

  return (
    <Form onSubmit={handleSubmit}>
      {submissionResp && (
        <FormAlert>
          <Alert
            variant={
              submissionResp.status === API_STATUS.SUCCESS
                ? "success"
                : "danger"
            }
            title={submissionResp.message}
            aria-live="polite"
            isInline
          />
        </FormAlert>
      )}
      <FormGroup
        label="LDAP Host"
        isRequired
        fieldId="host"
        validated={hasError("host")}
        helperTextInvalid={errors.host}
      >
        <TextInput
          isRequired
          id="host"
          name="host"
          value={values.host}
          onChange={(val, e) => handleHostChange(val, e)}
          onBlur={(e) => handleBlur()}
          validated={hasError("host")}
          isDisabled={!formActive}
          placeholder="customer.ldap.okta.com"
        />
      </FormGroup>

      <FormGroup
        label="LDAP SSL Port"
        isRequired
        fieldId="sslPort"
        validated={hasError("sslPort")}
        helperTextInvalid={errors.sslPort}
      >
        <TextInput
          isRequired
          id="sslPort"
          name="sslPort"
          value={values.sslPort}
          onChange={(val, e) => handleChange(e)}
          validated={hasError("sslPort")}
          isDisabled={!formActive}
          placeholder="636"
        />
      </FormGroup>

      <FormGroup
        label="LDAP Base DN"
        isRequired
        fieldId="baseDn"
        validated={hasError("baseDn")}
        helperTextInvalid={errors.baseDn}
      >
        <TextInput
          isRequired
          id="baseDn"
          name="baseDn"
          value={values.baseDn}
          onChange={(val, e) => handleChange(e)}
          validated={hasError("baseDn")}
          isDisabled={!formActive}
          placeholder="dc=customer, dc=okta, dc=com"
        />
      </FormGroup>

      <FormGroup
        label="LDAP User Base DN"
        isRequired
        fieldId="userBaseDn"
        validated={hasError("userBaseDn")}
        helperTextInvalid={errors.userBaseDn}
      >
        <TextInput
          isRequired
          id="userBaseDn"
          name="userBaseDn"
          value={values.userBaseDn}
          onChange={(val, e) => handleChange(e)}
          validated={hasError("userBaseDn")}
          isDisabled={!formActive}
          placeholder="ou=users, dc=customer, dc=okta, dc=com"
        />
      </FormGroup>

      <FormGroup
        label="LDAP Group Base DN"
        isRequired
        fieldId="groupBaseDn"
        validated={hasError("groupBaseDn")}
        helperTextInvalid={errors.groupBaseDn}
      >
        <TextInput
          isRequired
          id="groupBaseDn"
          name="groupBaseDn"
          value={values.groupBaseDn}
          onChange={(val, e) => handleChange(e)}
          validated={hasError("groupBaseDn")}
          isDisabled={!formActive}
          placeholder="ou=groups, dc=customer, dc=okta, dc=com"
        />
      </FormGroup>

      {enableFilters && (
        <>
          <HelperText>
            <HelperTextItem variant="indeterminate">
              If you wish to filter the users and groups returned by your LDAP
              server, you can optionally add LDAP queries here:
            </HelperTextItem>
          </HelperText>
          <FormGroup
            label="LDAP User Filter"
            fieldId="userFilter"
            validated={hasError("userFilter")}
            helperTextInvalid={errors.userFilter}
          >
            <TextInput
              id="userFilter"
              name="userFilter"
              value={values.userFilter}
              onChange={(val, e) => handleChange(e)}
              validated={hasError("userFilter")}
              isDisabled={!formActive}
            />
          </FormGroup>
          <FormGroup
            label="LDAP Group Filter"
            fieldId="groupFilter"
            validated={hasError("groupFilter")}
            helperTextInvalid={errors.groupFilter}
          >
            <TextInput
              id="groupFilter"
              name="groupFilter"
              value={values.groupFilter}
              onChange={(val, e) => handleChange(e)}
              validated={hasError("groupFilter")}
              isDisabled={!formActive}
            />
          </FormGroup>
        </>
      )}

      <ActionGroup style={{ marginTop: 0 }}>
        <Button
          type="submit"
          isDisabled={isSubmitting || !formActive}
          isLoading={isSubmitting}
        >
          Validate Config
        </Button>
      </ActionGroup>
    </Form>
  );
};
