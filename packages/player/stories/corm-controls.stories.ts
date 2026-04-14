import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "../src/components/corm-controls.ts";

const meta: Meta = {
  title: "Components/CormControls",
  component: "corm-controls",
  tags: ["autodocs"],
  argTypes: {
    disablePrev: { control: "boolean" },
    disableNext: { control: "boolean" },
    showChoiceMenu: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () =>
    html`
      <corm-controls></corm-controls>
    `,
};

export const ForwardOnly: Story = {
  name: "Forward Only (prev disabled)",
  render: () =>
    html`
      <corm-controls disable-prev></corm-controls>
    `,
};

export const AtStart: Story = {
  name: "At Start (prev disabled)",
  render: () =>
    html`
      <corm-controls disable-prev></corm-controls>
    `,
};

export const AtEnd: Story = {
  name: "At End (next disabled)",
  render: () =>
    html`
      <corm-controls disable-next></corm-controls>
    `,
};

export const BothDisabled: Story = {
  name: "Both Disabled",
  render: () =>
    html`
      <corm-controls disable-prev disable-next></corm-controls>
    `,
};

const sampleActivities = [
  { id: "mod-1", title: "Module 1: Introduction", available: true },
  { id: "mod-2", title: "Module 2: Risk Assessment", available: true },
  { id: "mod-3", title: "Module 3: Emergency Response", available: false },
  { id: "mod-4", title: "Module 4: Final Assessment", available: false },
];

export const WithChoiceMenu: Story = {
  name: "With Choice Menu",
  render: () =>
    html`
      <corm-controls
        show-choice-menu
        .availableActivities="${sampleActivities}"
      ></corm-controls>
    `,
};

export const Interactive: Story = {
  args: {
    disablePrev: false,
    disableNext: false,
    showChoiceMenu: true,
  },
  render: (args) =>
    html`
      <corm-controls
        ?disable-prev="${args.disablePrev}"
        ?disable-next="${args.disableNext}"
        ?show-choice-menu="${args.showChoiceMenu}"
        .availableActivities="${sampleActivities}"
      ></corm-controls>
    `,
};
