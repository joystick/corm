import type { StorybookConfig } from "@storybook/web-components-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.ts"],
  framework: {
    name: "@storybook/web-components-vite",
    options: {},
  },
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
  ],
};

export default config;
