import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "../src/components/corm-player.ts";

const meta: Meta = {
  title: "Components/CormPlayer",
  component: "corm-player",
  tags: ["autodocs"],
  argTypes: {
    courseId: { control: "text" },
    learnerId: { control: "text" },
    learnerName: { control: "text" },
    manifestUrl: { control: "text" },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () =>
    html`
      <corm-player
        course-id="h2s-safety-101"
        learner-id="learner-001"
        learner-name="Jane Doe"
        style="height: 600px;"
      ></corm-player>
    `,
};

export const WithManifest: Story = {
  render: () =>
    html`
      <corm-player
        course-id="fire-safety-201"
        learner-id="learner-002"
        learner-name="John Smith"
        manifest-url="/mock-manifest.json"
        style="height: 600px;"
      ></corm-player>
    `,
};

export const MinimalHeight: Story = {
  render: () =>
    html`
      <corm-player
        course-id="compact-course"
        learner-id="learner-003"
        style="height: 400px;"
      ></corm-player>
    `,
};
