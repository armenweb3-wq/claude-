import React from "react";
import { Composition } from "remotion";
import { NvidiaExplainer } from "./Video";
import { VIDEO } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition id="NvidiaExplainer" component={NvidiaExplainer} {...VIDEO} />
);
