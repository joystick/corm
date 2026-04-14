/**
 * In-memory mock MQTT client for testing.
 */

import type { MqttClient, MqttMessage } from "./mqtt-client.ts";

export class MockMqttClient implements MqttClient {
  private connected = false;
  private subscriptions = new Map<string, (payload: Uint8Array) => void>();
  private publishedMessages: MqttMessage[] = [];
  private connectionHandlers: Array<(connected: boolean) => void> = [];

  async connect(): Promise<void> {
    this.connected = true;
    this.notifyConnection(true);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.notifyConnection(false);
  }

  async publish(message: MqttMessage): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected");
    }
    this.publishedMessages.push({ ...message });
  }

  async subscribe(
    topic: string,
    handler: (payload: Uint8Array) => void,
  ): Promise<void> {
    this.subscriptions.set(topic, handler);
  }

  async unsubscribe(topic: string): Promise<void> {
    this.subscriptions.delete(topic);
  }

  isConnected(): boolean {
    return this.connected;
  }

  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  // --- Test helpers ---

  /** Returns all published messages. */
  getPublished(): MqttMessage[] {
    return [...this.publishedMessages];
  }

  /** Clears published messages. */
  clearPublished(): void {
    this.publishedMessages = [];
  }

  /** Simulate an incoming message on a topic. */
  simulateMessage(topic: string, payload: Uint8Array): void {
    const handler = this.subscriptions.get(topic);
    if (handler) {
      handler(payload);
    }
  }

  /** Simulate a disconnect event. */
  simulateDisconnect(): void {
    this.connected = false;
    this.notifyConnection(false);
  }

  /** Simulate a reconnect event. */
  simulateReconnect(): void {
    this.connected = true;
    this.notifyConnection(true);
  }

  private notifyConnection(state: boolean): void {
    for (const h of this.connectionHandlers) {
      h(state);
    }
  }
}
