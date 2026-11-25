export const PALETTE = {
  // Sunlit Tropical Gradient Sky & Horizon-Matched Atmospheric Fog
  skyBackground: 0x1686f2,
  skyZenith: 0x0550cc,
  skyMid: 0x168ef8,
  skyHorizon: 0x6cdaf6,
  skySunGlow: 0xffe8a8,
  fogColor: 0x6cdaf6,
  fogDensity: 0.00155,
  hemiSky: 0x82d8ff,
  hemiGround: 0x6f7948,
  sunColor: 0xfff0c2,

  // Ocean & Lagoon (vibrant faceted tropical aquamarine -> turquoise -> cerulean)
  oceanShallow: 0x00c4bc,
  oceanMid: 0x0079b8,
  oceanDeep: 0x003c8a,
  foamWhite: 0xffffff,

  // Terrain Biomes (calibrated for ACES Filmic + crisp warm-sun / cool-shadow contrast)
  sandGolden: 0xf4c259,
  sandWet: 0xcf9438,
  dirtOchre: 0xd98738,
  dirtEmbankment: 0xa86432,
  meadowLime: 0x67cc1d,
  meadowBright: 0x89e229,
  jungleEmerald: 0x2f9b22,
  jungleDeep: 0x1e7818,
  cliffStone: 0x827468,
  cliffWarm: 0x99836d,
  ruinsMoss: 0x65ba20,
  ruinsStone: 0x9b9283,

  // Smoking Volcano
  volcanoRockDark: 0x3b2a4a,
  volcanoRockMid: 0x5b4269,
  volcanoAsh: 0x8d5e58,
  volcanoTrail: 0xd67c32,
  lavaCore: 0xfff566,
  lavaGlow: 0xff8c14,
  lavaEdge: 0xd6390b,
  smokeWhite: 0xf4f1fa,

  // Skull Rock Cave
  skullBone: 0xe3cba4,
  skullBoneDark: 0xc2a67c,
  bandanaRed: 0xc93b26,
  bandanaShadow: 0x912416,
  eyepatchDark: 0x423430,
  torchFlame: 0xffb829,
  cobbleWarm: 0xc7955d,
  caveInterior: 0x4e392a,

  // Crystal Waterfall
  waterfallCyan: 0x2ce0ff,
  waterfallBright: 0xf0ffff,

  // Clouds, Foliage & Timber
  cloudWhite: 0xf7faff,
  palmTrunk: 0x8d5a34,
  palmLeaf: 0x45b526,
  woodDock: 0x84522a,
  woodRope: 0xd1a96f,
} as const;
