import { useRoleAccess } from "@app/hooks";
import { useAppDispatch, useAppSelector } from "@app/hooks/hooks";
import { setOrganization } from "@app/services";
import {
  Button,
  Checkbox,
  Divider,
  FormGroup,
  Modal,
  ModalVariant,
} from "@patternfly/react-core";
import { useKeycloak } from "@react-keycloak/web";
import React, { useState, useEffect } from "react";

type Props = {
  open: boolean;
  toggleModal: (modalOpen: boolean) => void;
};

const OrgPicker: React.FC<Props> = ({
  open: isModalOpen,
  toggleModal: setIsModalOpen,
}) => {
  const { hasOrganizationRoles, hasRealmRoles } = useRoleAccess();
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.settings.selectedOrg);
  const { keycloak } = useKeycloak();
  const orgs = keycloak?.tokenParsed?.organizations;
  console.log("[orgs]", orgs, currentOrg);

  const [selectedOrg, setSelectedOrg] = useState<string>();

  useEffect(() => {
    if (currentOrg) setSelectedOrg(currentOrg);
  }, [currentOrg]);

  const handleModalConfirm = () => {
    dispatch(setOrganization(selectedOrg || currentOrg!));
    handleModalToggle();
  };

  const handleModalToggle = () => {
    setIsModalOpen(!isModalOpen);
    setSelectedOrg(undefined);
  };

  const onEscapePress = () => {
    handleModalToggle();
  };

  const OrgCheckboxGroups = Object.keys(orgs).map((orgId) => {
    const orgName = orgs[orgId].name;

    const hasAdminRole = hasOrganizationRoles("admin", orgId);

    if (!hasAdminRole) return <></>;

    return (
      <div className="checkbox-group" key={orgId}>
        <FormGroup role="group" fieldId={`basic-form-checkbox-group-${orgId}`}>
          <Checkbox
            label={orgName}
            aria-label={orgName}
            id={orgId}
            description={`Configure the ${orgName} organziation.`}
            isChecked={orgId === selectedOrg}
            onChange={() => setSelectedOrg(orgId)}
          />
        </FormGroup>
      </div>
    );
  });

  return (
    <Modal
      title="Organization Selector"
      variant={ModalVariant.small}
      isOpen={isModalOpen}
      onClose={handleModalToggle}
      actions={[
        <Button key="confirm" variant="primary" onClick={handleModalConfirm}>
          Confirm
        </Button>,
        <Button key="cancel" variant="link" onClick={handleModalToggle}>
          Cancel
        </Button>,
      ]}
      onEscapePress={onEscapePress}
    >
      <div>
        For which Organization are you configuring an Identity Provider?
      </div>
      <br />
      <div>{OrgCheckboxGroups.map((grp) => grp)}</div>
      {hasRealmRoles("admin") && (
        <>
          <Divider className="pf-u-mt-lg pf-u-mb-lg" />
          <div className="checkbox-group">
            <FormGroup role="group" fieldId={`basic-form-checkbox-group-realm`}>
              <Checkbox
                label="Global"
                aria-label="Global"
                id={`realm_global`}
                description={`No organization selected. Site administration config.`}
                isChecked={"realm_global" === selectedOrg}
                onChange={() => setSelectedOrg("realm_global")}
              />
            </FormGroup>
          </div>{" "}
        </>
      )}
    </Modal>
  );
};

export { OrgPicker };
