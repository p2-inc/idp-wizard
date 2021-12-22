import {
  Card,
  CardBody,
  FileUpload,
  Form,
  FormGroup,
} from "@patternfly/react-core";
import React, { useEffect, useState } from "react";
import azureStep13Image from "@app/images/azure/azure-13.png";
import { InstructionProps, Step, StepImage } from "@wizardComponents";

export function AzureStepFive() {
  const [value, setValue] = useState();
  const [filename, setFilename] = useState();

  const handleFileChange = (value, filename, event) => {
    console.log("File uploaded: ", filename, value);
    setValue(value);
    setFilename(filename);
  };

  useEffect(() => {
    document?.getElementById("step")?.scrollIntoView();
  });

  const instructionList: InstructionProps[] = [
    {
      text: "Download the certificate (Base64) from Step 3 and upload it below.",
      component: <StepImage src={azureStep13Image} alt="Step 5.1" />,
    },
    {
      component: (
        <Card className="card-shadow">
          <CardBody>
            <Form>
              <FormGroup label="Certificate (Base64)" fieldId="file-form">
                <FileUpload
                  id="simple-file"
                  value={value}
                  filename={filename}
                  filenamePlaceholder="Drag or choose a file .cer, .cert, .key, .pem to upload."
                  browseButtonText="Upload"
                  onChange={handleFileChange}
                  // onReadStarted={handleFileReadStarted}
                  // onReadFinished={handleFileReadFinished}
                />
              </FormGroup>
            </Form>
          </CardBody>
        </Card>
      ),
    },
  ];

  return (
    <Step title="SAML Signing Certificate" instructionList={instructionList} />
  );
}
