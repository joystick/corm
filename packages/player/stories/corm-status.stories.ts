import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "../src/components/corm-status.ts";

const meta: Meta = {
  title: "Components/CormStatus",
  component: "corm-status",
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["online", "offline"],
    },
  },
};

export default meta;
type Story = StoryObj;

export const Online: Story = {
  render: () =>
    html`
      <corm-status status="online"></corm-status>
    `,
};

export const Offline: Story = {
  render: () =>
    html`
      <corm-status status="offline"></corm-status>
    `,
};

export const Interactive: Story = {
  args: {
    status: "online",
  },
  render: (args) =>
    html`
      <corm-status status="${args.status}"></corm-status>
    `,
};
