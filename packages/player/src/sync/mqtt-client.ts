/**
 * MQTT client abstraction for CORM sync transport.
 * Defines the interface; real implementations (mqtt.js, etc.) plugged in later.
 */

export interface MqttMessage {
  topic: string;
  payload: Uint8Array;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export interface MqttClientOptions {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  keepAlive?: number;
}

export interface MqttClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(message: MqttMessage): Promise<void>;
  subscribe(
    topic: string,
    handler: (payload: Uint8Array) => void,
  ): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
  isConnected(): boolean;
  onConnectionChange(handler: (connected: boolean) => void): void;
}

/**
 * Creates a stub/no-op MQTT client. Real transport is plugged in later.
 */
export function createMqttClient(options: MqttClientOptions): MqttClient {
  const _options = options;
  let connected = false;
  const connectionHandlers: Array<(connected: boolean) => void> = [];
  const subscriptions = new Map<string, (payload: Uint8Array) => void>();

  return {
    async connect() {
      connected = true;
      for (const h of connectionHandlers) h(true);
    },
    async disconnect() {
      connected = false;
      for (const h of connectionHandlers) h(false);
    },
    async publish(_message: MqttMessage) {
      // no-op stub
    },
    async subscribe(
      topic: string,
      handler: (payload: Uint8Array) => void,
    ) {
      subscriptions.set(topic, handler);
    },
    async unsubscribe(topic: string) {
      subscriptions.delete(topic);
    },
    isConnected() {
      return connected;
    },
    onConnectionChange(handler: (connected: boolean) => void) {
      connectionHandlers.push(handler);
    },
  };
}
