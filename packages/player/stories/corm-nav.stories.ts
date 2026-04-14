import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "../src/components/corm-nav.ts";

const meta: Meta = {
  title: "Components/CormNav",
  component: "corm-nav",
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    progress: { control: { type: "range", min: 0, max: 100, step: 1 } },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () =>
    html`
      <corm-nav title="H2S Safety Training"></corm-nav>
    `,
};

export const WithProgressZero: Story = {
  name: "Progress: 0%",
  render: () =>
    html`
      <corm-nav title="Fire Safety" progress="0"></corm-nav>
    `,
};

export const WithProgressHalf: Story = {
  name: "Progress: 50%",
  render: () =>
    html`
      <corm-nav title="Fire Safety" progress="50"></corm-nav>
    `,
};

export const WithProgressComplete: Story = {
  name: "Progress: 100%",
  render: () =>
    html`
      <corm-nav
        title="Fire Safety - Complete"
        progress="100"
      ></corm-nav>
    `,
};

export const Interactive: Story = {
  args: {
    title: "Interactive Course Title",
    progress: 33,
  },
  render: (args) =>
    html`
      <corm-nav
        title="${args.title}"
        progress="${args.progress}"
      ></corm-nav>
    `,
};
