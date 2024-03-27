import { Client, Snowflake } from "discord.js";

export interface TipupClientOptions {
  client: Client;
  apiKey?: string;
  dev?: {
    tipupApiUrl: string;
  };
}

export type TipupGiftSlug =
  | "ROSE"
  | "BLOSSOM"
  | "SUNFLOWER"
  | "MAGNET"
  | "DART"
  | "SHARK"
  | "MOYAI"
  | "GUITAR"
  | "CROWN"
  | "GEM";

export type TipupRequestPaymentStatus = "PAID" | "DECLINED";

export type TipupClientRequestPaymentParams =
  | { userId: Snowflake; tokens: number }
  | { userId: Snowflake; gift: TipupGiftSlug };

export interface TipupClient {
  startOneTimeSetup: (params: { channelId: Snowflake; ownerUserId: Snowflake }) => Promise<void>;
  requestPayment: (
    params: TipupClientRequestPaymentParams
  ) => Promise<{ requestId: number; status: TipupRequestPaymentStatus }>;
}

const defaultTipupApiUrl = "https://api.tipup.app";

const waitFor = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const createTipupClient = (options: TipupClientOptions): TipupClient => {
  const tipupApiUrl = options.dev?.tipupApiUrl ?? defaultTipupApiUrl;

  return {
    startOneTimeSetup: async (params) => {
      const botUserId = options.client.user?.id;
      if (!botUserId) {
        throw new Error("createTipupClient(): client is not ready");
      }

      const channel = await options.client.channels.fetch(params.channelId);
      if (!channel) {
        throw new Error(`startOneTimeSetup(): Couldn't find a channel by channelId ${params.channelId}`);
      }

      if (!channel.isTextBased()) {
        throw new Error(`startOneTimeSetup(): Channel ${params.channelId} is not a text channel`);
      }

      const message = await channel.send({ content: `tipup-start-bot-setup:${params.ownerUserId}` });
      await waitFor(5000);
      await message.delete();
    },
    requestPayment: async (params) => {
      const botUserId = options.client.user?.id;
      if (!botUserId) {
        throw new Error("createTipupClient(): client is not ready");
      }

      if (!options.apiKey) {
        throw new Error("createTipupClient(): apiKey is not defined");
      }

      const response = await fetch(`${tipupApiUrl}/request-payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: botUserId,
          userId: params.userId,
          tokens: "tokens" in params ? params.tokens : undefined,
          gift: "gift" in params ? params.gift : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`requestPayment(): ${result?.error ?? "Unknown error occurred"}`);
      }

      return result;
    },
  };
};
