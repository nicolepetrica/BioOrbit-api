export type ChatSource = {
  title: string;
  link: string;
  journal?: string;
  year?: string | number;
  authors?: string;
  keywords?: string[];   // or string[] if your backend sends arrays
  tldr?: string;
  doi?: string;
};

export type ChatResponse = {
  answer: string;
  source: ChatSource[];
};
