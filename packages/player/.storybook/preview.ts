import type { Preview } from "@storybook/web-components";
import "../src/styles/theme.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "navy",
      values: [
        { name: "navy", value: "#112236" },
        { name: "navy-dark", value: "#0a1628" },
        { name: "white", value: "#ffffff" },
        { name: "shadcn-default", value: "hsl(0 0% 100%)" },
      ],
    },
  },
};

export default preview;
