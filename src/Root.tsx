import { Composition, Folder } from "remotion";
import { Main } from "./Main";
import { ClawdbotVideo } from "./clawdbot";
import { XOAgencyVideo } from "./xo-agency";

import { calculateMetadata } from "./calculate-metadata/calculate-metadata";
import { schema } from "./calculate-metadata/schema";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        defaultProps={{
          steps: null,
          themeColors: null,
          theme: "github-dark" as const,
          codeWidth: null,
          width: {
            type: "auto",
          },
        }}
        fps={30}
        height={1080}
        calculateMetadata={calculateMetadata}
        schema={schema}
      />

      <Folder name="XO-Videos">
        <Composition
          id="ClawdbotVideo"
          component={ClawdbotVideo}
          durationInFrames={450}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="XOAgencyVideo"
          component={XOAgencyVideo}
          durationInFrames={1800}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
