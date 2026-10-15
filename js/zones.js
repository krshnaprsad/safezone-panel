/* Safe-zone margins in pixels on a 1080x1920 frame.
   "official" = platform ad guides / templates. "organic" = measured in the apps (no official figure).
   Edit these numbers when an app changes its layout. "rail" widens the right margin
   below from_y (the button column). */
var ZONES = {
  frame: [1080, 1920],
  platforms: {
    reels: {
      label: "Instagram Reels",
      official: { top: 269, bottom: 672, left: 65, right: 65, rail: { from_y: 1150, right: 227 } },
      organic: { top: 250, bottom: 319, left: 86, right: 119 }
    },
    tiktok: {
      label: "TikTok",
      official: { top: 240, bottom: 660, left: 120, right: 120, rail: { from_y: 840, right: 300 } },
      organic: { top: 200, bottom: 334, left: 86, right: 140 }
    },
    shorts: {
      label: "YouTube Shorts",
      official: { top: 288, bottom: 672, left: 48, right: 192 },
      organic: { top: 380, bottom: 390, left: 60, right: 201 }
    }
  }
};
