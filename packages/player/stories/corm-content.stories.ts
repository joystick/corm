import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "../src/components/corm-content.ts";

const meta: Meta = {
  title: "Components/CormContent",
  component: "corm-content",
  tags: ["autodocs"],
  argTypes: {
    content: { control: "text" },
    contentType: {
      control: "select",
      options: ["markdown", "sco"],
    },
    rejectionMessage: { control: "text" },
  },
  decorators: [
    (story) =>
      html`
        <div style="height: 400px; display: flex;">${story()}</div>
      `,
  ],
};

export default meta;
type Story = StoryObj;

const sampleHtml = `
  <h2>Hydrogen Sulfide (H2S) Safety</h2>
  <p>
    Hydrogen sulfide is a colourless, flammable gas with a characteristic
    odour of rotten eggs. It is heavier than air and can accumulate in
    low-lying or enclosed spaces.
  </p>
  <h3>Key Properties</h3>
  <ul>
    <li><strong>Chemical formula:</strong> H<sub>2</sub>S</li>
    <li><strong>Exposure limit:</strong> 10 ppm (8-hour TWA)</li>
    <li><strong>IDLH:</strong> 100 ppm</li>
  </ul>
  <p>
    Always use appropriate PPE when entering areas where H2S may be present.
    Monitor gas levels continuously with a calibrated detector.
  </p>
`;

export const MarkdownContent: Story = {
  render: () =>
    html`
      <corm-content
        .content="${sampleHtml}"
        content-type="markdown"
        style="flex: 1;"
      ></corm-content>
    `,
};

export const RejectionMessage: Story = {
  render: () =>
    html`
      <corm-content
        rejection-message="You must complete the previous module before accessing this content. Please go back and finish 'Module 2: Risk Assessment'."
        style="flex: 1;"
      ></corm-content>
    `,
};

export const EmptyState: Story = {
  render: () =>
    html`
      <corm-content
        content=""
        content-type="markdown"
        style="flex: 1;"
      ></corm-content>
    `,
};

export const Interactive: Story = {
  args: {
    content:
      "<h2>Interactive Content</h2><p>Edit this content via controls.</p>",
    contentType: "markdown",
    rejectionMessage: "",
  },
  render: (args) =>
    html`
      <corm-content
        .content="${args.content}"
        content-type="${args.contentType}"
        rejection-message="${args.rejectionMessage}"
        style="flex: 1;"
      ></corm-content>
    `,
};
