import React from "react";
import { Composition } from "remotion";
import { Session1, session1 } from "./session1";
import { Session2, session2 } from "./session2";
import { Session3, session3 } from "./session3";

const size = { width: 1920, height: 1080, fps: 30 };

export const EduCompositions: React.FC = () => (
  <>
    <Composition id="Edu1-AccountBasics" component={Session1} {...size} durationInFrames={session1.tl.totalFrames} />
    <Composition id="Edu2-OrdersMarketTypes" component={Session2} {...size} durationInFrames={session2.tl.totalFrames} />
    <Composition id="Edu3-AdvancedStrategies" component={Session3} {...size} durationInFrames={session3.tl.totalFrames} />
  </>
);
