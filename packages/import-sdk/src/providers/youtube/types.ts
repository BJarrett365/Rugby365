export type YoutubeFeedVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  watchUrl: string;
  channelId: string;
};

export type YoutubeHighlightMatchTitle = {
  homeName: string;
  awayName: string;
  competitionHint: string | null;
  roundHint: string | null;
  /** Parsed round number when present (e.g. Currie Cup Round 3 → 3). */
  roundNumber: number | null;
};

export type YoutubeHighlightListing = YoutubeFeedVideo & {
  match: YoutubeHighlightMatchTitle | null;
};

export type YoutubeChannelFeedPreview = {
  kind: "youtube_channel_feed";
  channelId: string;
  sourceUrl: string;
  videos: YoutubeFeedVideo[];
  highlightListings: YoutubeHighlightListing[];
};
