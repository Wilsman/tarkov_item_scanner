export interface MessageContentText {
  type: 'text';
  text: string;
}

export interface MessageContentImageUrl {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type MessageContent = MessageContentText | MessageContentImageUrl;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  response_format?: {
    type: 'text' | 'json_object';
  };
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ItemCount {
  name: string;
  count: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
  response_format?: {
    type: 'text' | 'json_object';
  };
}
