import { Client, Snowflake } from "discord.js";

export interface TipupClientOptions {
  client: Client;
  apiKey?: string;
  dev?: {
    tipupApiUrl: string;
    tipupBotUserId: string;
  };
}

export type TipupClientRequestPaymentParams =
  | { userId: Snowflake; tokens: number }
  | { userId: Snowflake; gift: string };

export interface TipupClient {
  generateApiKey: (params: { channelId: string; userId: string }) => Promise<void>;
  requestPayment: (
    params: TipupClientRequestPaymentParams
  ) => Promise<{ requestId: number; status: "PAID" | "DECLINED" }>;
}

const defaultTipupApiUrl = "https://api.tipup.app";
const defaultTipupBotUserId = "1211252667553419325";

const waitFor = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const createTipupClient = (options: TipupClientOptions): TipupClient => {
  const tipupApiUrl = options.dev?.tipupApiUrl ?? defaultTipupApiUrl;
  const tipupBotUserId = options.dev?.tipupBotUserId ?? defaultTipupBotUserId;

  return {
    generateApiKey: async (params) => {
      const botUserId = options.client.user?.id;
      if (!botUserId) {
        throw new Error("createTipupClient(): client is not ready");
      }

      const tipupBotUser = await options.client.users.fetch(tipupBotUserId);
      if (!tipupBotUser) {
        throw new Error(
          "generateApiKey(): You need to add Tipup bot to your server: https://tipup.app/add-to-discord"
        );
      }

      const channel = await options.client.channels.fetch(params.channelId);
      if (!channel) {
        throw new Error(`generateApiKey(): Couldn't find a channel by channelId ${params.channelId}`);
      }

      if (!channel.isTextBased()) {
        throw new Error(`generateApiKey(): Channel ${params.channelId} is not a text channel`);
      }

      const message = await channel.send({ content: `tipup-api-key:${params.userId}` });
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
