/* S04 "always open" (6-10 s): a dot-grid world map with the four session
 * nodes. A band of light travels west with the trading day, one node per
 * beat; a 24-hour bar then fills with four overlapping session arcs and a
 * week strip lights five of its seven cells. In the last 8 frames the map
 * collapses into the flat line that S05 turns into its price line.
 *
 * There is no map data or image asset: the land mask is rasterised at build
 * time from the hand-simplified coastlines below, straight onto the dot grid.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease, el } = AD

  // Simplified coastlines as "lon,lat" vertex lists (degrees, equirectangular).
  // Small islands are drawn a little fat so they survive the dot grid.
  const LAND = [
    // North and Central America
    '-168,65.6 -162,66.6 -166.5,68.3 -156.5,71.3 -148,70.4 -141,69.6 -135,69.4 -128,70.4 -122,69.8 -115,68.2 -108,68 -101,67.8 -96,68.5 -94.5,71.8 -90,69 -85,69.8 -81.5,69.3 -84,66.8 -87.5,65.5 -88.5,64 -92,62.8 -94.2,60.5 -94.4,58.8 -92.5,57 -88.5,56.5 -85,55.4 -82.3,55.1 -82.2,53 -80.5,51.2 -79,51.6 -78.8,54 -76.8,56.5 -77.6,58.5 -78.3,60.8 -77.8,62.5 -73,62.3 -70,61 -69.5,59 -67,58.3 -65,60.3 -62,57.5 -60,55.5 -57.5,54 -55.7,52.3 -59,50.3 -66,50.2 -69.5,48.3 -64.3,48.9 -65,47 -64,46 -60,46.6 -61,45.2 -65.6,43.5 -66.2,45 -67,44.6 -70,43.6 -70,41.8 -74,40.6 -75.6,38 -75.6,35.2 -78,34 -81,32 -81.3,30 -80,27 -80.3,25.3 -81.2,25.1 -82.8,27.8 -82.8,29.5 -84.3,30 -85.6,29.7 -88,30.3 -89.3,29.1 -91,29.3 -94,29.6 -97.3,27.8 -97.6,25 -97.8,22.3 -96,19.1 -94.5,18.2 -92,18.6 -90.7,19.8 -90.3,21 -87,21.6 -86.8,20.3 -88,17.5 -88.4,15.8 -86,15.9 -83.2,15 -83.6,12.5 -83.5,10.9 -82.5,9.4 -81,8.7 -79.9,9.4 -78,9.4 -77.2,8.6 -77.6,7.6 -78.3,8.3 -80,7.3 -81.5,7.6 -83,8.2 -85.2,9.9 -85.8,11 -87.4,12.8 -89.8,13.5 -92,14.5 -94.5,16.2 -96.5,15.7 -99.9,16.8 -103.5,18.3 -105.6,20.4 -106.4,23.2 -109.4,26 -111,28 -112.8,30 -114.7,31.7 -114,30 -112.2,27.5 -110.3,24.3 -110,22.9 -112.2,24.8 -114.2,27.2 -115,27.9 -114.6,29.5 -116,30.6 -117.1,32.5 -118.5,34 -120.5,34.5 -122.5,37.8 -124.4,40.4 -124.2,43 -124,46.2 -124.7,48.4 -125.5,49 -128.3,50.8 -127.6,52 -130.3,54.3 -133,56 -135.5,58 -139.7,59.6 -144,60 -147,60.8 -149.5,59.8 -151.8,59.2 -150.5,61.2 -153.3,59.8 -154.5,58.3 -157,57 -160,55.5 -163.5,54.8 -160.5,56 -158,57.6 -157,58.7 -159,58.8 -162,59 -162.2,60 -165.5,62.5 -161,63.6 -161,64.5 -165.4,64.5',
    // Canadian Arctic, Greenland, Iceland, Newfoundland, Caribbean
    '-89,73.5 -81,73.8 -76,72.8 -70,70.6 -67.5,69 -62,66.7 -63.5,64.8 -66,62.6 -65,61.8 -70,62.7 -74.5,64.4 -78,64.6 -77.5,65.6 -73.5,66 -73,68 -75,68.4 -78.5,70 -82,70.2 -85,70 -88.5,71 -90,72.5',
    '-118,71.5 -115,73.3 -108,73 -105,71.5 -101,70 -102,68.8 -107,68.6 -113,68.6 -117,69.8',
    '-125,72 -123.5,74.3 -116.5,73.3 -118.5,72 -121.5,71.2',
    '-110,75 -105,76.5 -97,76.5 -90,76.8 -80,76 -79,74.6 -90,74.5 -96,75 -104,74.8',
    '-90,77 -75,78 -62,82 -70,83 -90,81.5 -93,79',
    '-73,78.2 -68,76 -59,75.8 -55,72 -53.5,69.5 -53.5,67 -52,64.4 -49,61.5 -44,59.8 -42,62.5 -40,65 -37,65.7 -32,68 -26,68.6 -22,70.5 -20,73.5 -18.5,76 -17,79.5 -12,81.5 -28,83.3 -45,82.5 -60,82 -67,80.5',
    '-24.3,65.5 -22,66.4 -16,66.5 -13.6,65.2 -15,64.2 -19,63.4 -22.7,63.8 -24,64.8',
    '-59.2,47.6 -57.3,50.5 -55.8,51.6 -55,49.5 -53,48.8 -52.7,47 -53.5,46.6 -56,46.9',
    '-85,21.8 -82,23.2 -79,22.8 -75,20.8 -74.2,20 -77.5,19.8 -78.5,21.1 -81.5,21.8 -84,21.4',
    '-74.4,18.6 -73,19.9 -70,19.9 -68.4,18.6 -70.5,18.1 -72.5,18.1',
    // South America
    '-77.2,8.6 -75.5,10.6 -74.8,11.1 -71.7,12.4 -71.5,10.9 -70,12.2 -68,10.6 -66,10.6 -62,10.7 -60.5,8.8 -58,6.8 -55,6 -52,4.9 -51.5,4.4 -50,0 -48,-0.7 -44.3,-2.5 -40,-2.8 -37,-4.6 -35.3,-5.5 -34.9,-8 -37,-11 -38.5,-13 -39,-17.5 -40.3,-20.3 -42,-22.9 -43.2,-23 -46.3,-24 -48.5,-26 -48.6,-27.6 -50.3,-30.3 -52.5,-33 -53.5,-34.2 -55,-35 -56.2,-34.9 -58.4,-34.3 -56.7,-36.4 -57.5,-38 -62.2,-38.9 -62.2,-40.8 -65,-41 -63.6,-42.5 -65.3,-45 -67.5,-46 -65.8,-47.2 -68.9,-50.3 -69.2,-51.6 -68.4,-52.3 -68.6,-53 -65.2,-54.7 -67.3,-55.9 -70.5,-55 -73,-53.5 -75.5,-50 -75.6,-48 -74.5,-46 -73.5,-44 -74.2,-42.5 -73.7,-41.5 -73.5,-39.5 -73.6,-37.2 -71.6,-33 -71.5,-30 -70.6,-26 -70.4,-23.6 -70.3,-18.5 -72,-17.2 -76.3,-13.9 -77.1,-12 -78.6,-9 -79.9,-6.8 -81.3,-4.7 -80,-3 -80.9,-2.2 -80.1,0.2 -79.6,1 -78.8,1.8 -77.4,3.9 -77.5,6.5 -77.9,7.2',
    // Africa and Madagascar
    '-5.9,35.8 -2,35.2 -0.6,35.8 3,36.8 8,36.9 9.8,37.3 11,37 10.2,35.5 10,34 11.1,33.2 13.2,32.9 15.2,32.4 18,30.5 19.5,30.3 20,32.1 22,32.9 24,32 25.5,31.6 30,31.2 31.5,31.5 32.3,31.3 32.5,30 33.6,27.5 35.5,24 37.2,21 37.2,19.6 38.5,18 39.5,15.6 41,14.5 42.7,13 43.3,11.6 44,10.5 45,10.4 48,11.2 51.3,11.8 51.2,10.4 50,8 48,4.5 45.3,2 42.5,-0.6 39.7,-4 39.3,-6.8 40.5,-10.5 40.8,-14.5 37,-17.8 34.9,-19.8 35.5,-23.8 32.6,-26 31,-29.9 28,-33 25.6,-34 20,-34.8 18.4,-34 18,-32 16.5,-28.6 15.1,-26.6 14.5,-23 11.8,-18 11.8,-16.5 13.4,-12.5 13.2,-8.8 12.2,-6 11.8,-4.8 8.8,-0.7 9.4,0.4 9.7,2.5 9.6,4 8.5,4.5 6,4.3 3.4,6.4 1,5.9 -0.2,5.5 -2.1,4.7 -4,5.2 -7.7,4.4 -10.8,6.3 -13.2,8.5 -13.7,9.5 -16,11.8 -16.6,13.4 -17.5,14.7 -16.5,16 -16,18.1 -17,20.8 -16,23.7 -14.5,26 -12.9,27.9 -10.2,29.4 -9.6,30.4 -9.8,31.5 -7.6,33.6 -6.8,34',
    '49.3,-12 50.5,-15.5 49.5,-18 47.5,-25 45,-25.6 43.5,-23.5 43.3,-22 44.3,-19.8 44,-16.2 46.3,-15.7 48,-13.5',
    // Eurasia (the far east of Siberia runs past 180 degrees)
    '-9,37 -9.5,38.7 -8.8,41.2 -9.3,43 -8,43.7 -3,43.4 -1.6,43.4 -1.2,45.5 -2.2,47.2 -4.7,48.4 -1.6,48.7 -1.6,49.7 0.1,49.5 1.8,51 4,52 4.7,53 7,53.6 8.8,54 8.2,55.5 8.1,57.1 10.6,57.7 10.2,56.5 9.8,55 10.1,54.4 11,54 12.1,54.2 14.2,54 18.7,54.4 20,54.7 21,55.7 21,57.5 22.6,57.7 24.1,57 24.4,58.4 23.5,59.2 24.7,59.5 28,59.5 30.2,59.9 28.7,60.7 25,60.2 23,59.8 22,60.4 21.3,61.5 21.5,63 25.4,65 24.1,65.8 22.2,65.6 20.3,63.8 17.4,62.4 17.2,60.7 18.1,59.3 16.5,57.5 15.6,56.2 14.3,55.5 13,55.6 11.9,57.7 10.7,59.3 8,58.1 7,58 5.7,59 5.3,60.4 5,62 6.2,62.5 9.5,63.8 11.5,65 14.4,67.3 19,69.7 25.8,71.1 31.1,70.4 33.5,69.5 40.5,67.5 41,66.3 38,66.2 33.5,66.7 35,64.4 37.5,64 40.5,64.6 42,66.3 44.2,68.6 48,67.6 53,68.8 58,68.9 60.5,69.8 64.5,69.3 66,68.9 68.5,71.5 70,73 72.5,72.8 73,71.5 72.5,68.5 74.5,68.6 73.8,71.5 75,72.6 77,72.3 80.5,73.5 87,75.2 95,76.2 104,77.7 112,76.5 113,73.8 126,73.5 128,72.5 131,71 135,71.5 140,72.5 146,72.3 150,71.3 161,69.5 165,69.6 170,69 170.5,70 176,69.7 179.5,68.9 185,67.3 190.3,66.1 187.5,64.4 181,66 177.5,64.7 179.2,62.3 173,61 170.3,60 166,60.3 163.5,58 162.8,57.8 163,56.2 161.8,55 160,53.2 158.6,53 156.7,51 156,53 155.6,56 156.8,57.8 160,60 163,62 160,61.8 156.5,61.5 150.8,59.6 145,59.4 143.2,59.4 140,57.5 137,54.8 135.2,54.7 138,54 141,53.2 141.5,52 141,50 140.3,48.5 138.5,46.5 136,44.5 132,43.1 130.7,42.3 129.7,41.3 127.5,39.3 129.4,36.5 129.1,35.1 126.5,34.4 126.4,36.7 126.6,37.5 125,38 125.2,39.6 124.3,39.9 121.6,38.9 122.2,40.7 119.5,39.8 117.8,39 119,37.3 120.8,37.8 122.5,37.2 120.3,36.1 119.3,35 120.9,32.6 121.8,31.2 121,30.3 122,29.9 121,28 119.6,26 118.1,24.5 116.7,23.3 114.2,22.3 111,21.5 110.3,20.3 109.7,21.5 108,21.6 106.8,20.8 105.7,18.7 108.3,16.1 109.2,13.8 109.2,11.9 107,10.4 104.8,8.6 104.9,10.3 103.5,10.6 102.6,12.2 100.9,13.4 100.5,13.5 100,12.8 99.2,10.5 100.2,8.4 101.3,6.9 102.3,6.2 103.4,4.5 103.4,3.8 103.9,1.3 102.3,2.2 101.3,3 100.3,5.4 99.7,6.4 98.3,7.9 98.6,10 98.6,12 98,14 97.6,16.5 96.2,16.6 94.3,16 94.5,18.8 92.9,20.1 91.8,22.3 90,22 88.3,21.6 87,21.3 86.7,20.2 83.3,17.7 80.3,15.5 80.3,13.1 79.8,10.3 77.5,8.1 76.2,10 74.8,12.9 73.8,15.5 72.8,19 72.6,21 72.1,21.3 71,20.7 69,22.3 70,22.7 68.5,23.5 67,24.8 64.5,25.3 62.3,25.1 59,25.4 57.2,26.7 56.3,27.2 54,26.6 50.8,28.9 49.5,30.2 48,29.5 48.8,27.8 50.2,26.6 50.8,24.8 51.6,24.3 54.4,24.4 55.3,25.3 56.3,26.3 56.6,24.5 58.6,23.6 59.8,22.5 58.5,20.4 57.7,19 54,17 52.2,16 49,14.5 45,12.8 43.5,12.7 42.9,14.8 42.6,16.9 41,19.5 39.2,21.5 38,24.1 36.5,26 35,28 35,29.5 34.3,27.8 32.5,30 32.3,31.3 34.2,31.3 34.8,32.1 35.5,33.9 35.8,35.5 36.2,36.6 34.6,36.8 32.5,36.1 30.7,36.9 28.3,36.7 27.3,37 26.8,38.4 26.2,39.5 26.2,40 26,40.8 23,40.6 24,40 22.9,39.3 23.7,38 23.2,36.4 22.4,36.4 21.7,36.8 21.1,37.8 20.7,38.8 20,39.7 19.4,40.4 19.4,41.3 18.9,42.2 18.1,42.6 16.4,43.5 15.2,44.2 14.4,45.3 13.6,44.9 13.8,45.6 12.3,45.4 12.4,44.2 13.5,43.6 14.2,42.4 16.2,41.9 16.9,41.1 18,40.6 18.5,40.1 18.3,39.8 17.2,40.4 16.6,39.7 17.2,39 16.5,38.3 15.6,37.9 16,39 15.6,40 14.2,40.8 12.2,41.7 11,42.4 10.3,43.5 8.9,44.4 7.3,43.7 5.4,43.3 3.1,43.2 3.1,42.4 2.2,41.4 -0.3,39.5 0.2,38.7 -1,37.6 -2.4,36.8 -4.4,36.7 -5.4,36.1 -6.3,36.5 -7,37.2',
    // Britain, Ireland, Mediterranean and Arctic islands
    '-6,49.9 -3,50.3 1.6,50.9 2,52.8 0.5,53.7 -1.1,55.1 -1.6,57.3 -3,58.9 -5.3,58.9 -6.6,57.5 -6,56.2 -5.4,55 -3.6,54.7 -3.4,53.8 -5,53.3 -5,52.2 -5.6,51.7 -3.4,51.2 -4.9,50.9',
    '-10,51.6 -6.2,52.2 -6,53.4 -5.6,54.6 -6.5,55.2 -8.3,55.2 -10,54.2 -10,53.4 -9.5,52.5',
    '12.4,38 15.6,38.3 15.2,36.7 12.6,37.4',
    '8.2,39 9.7,39.1 9.8,41 9.5,43 8.6,42.4 8.2,40.8',
    '51.5,71 55,73.5 61,76 68.5,77 66,75.5 58,73.5 57,70.6 53,70.8',
    '11,79.6 14,77.3 18,76.6 22,78 27,79.8 20,80.4',
    // Japan, Sakhalin, Taiwan, Hainan, Sri Lanka
    '129.4,33.4 129.6,32.2 130.2,30.9 131.6,31 132.3,32.6 133.2,32.4 134.9,33.4 136,33.1 137.2,34.3 139,34.3 140.3,34.7 141.3,35.6 141.6,38 142.5,39.6 142,41.8 140,41.6 139.3,39.6 138,37.9 137.2,38 135.6,36.4 134,36 132,35.5 130.6,34.8',
    '139.5,42 141.3,45.8 145.6,44.6 146,43.2 143.4,41.7 141,42.2 140,41.3',
    '142,46 143.5,46.8 143.3,49.3 144.5,49 143.2,52.5 143,54.3 142,53.5 141.8,51.5 142.1,48',
    '120.1,23 121,25.3 122,25 121.5,23 120.8,22',
    '108.6,19.2 110.2,20.1 111,19.6 110,18.2 108.7,18.5',
    '79.7,8 80.2,9.8 81.9,7.5 81.6,6.3 80.2,6',
    // Philippines, Indonesia, New Guinea
    '120.3,18.5 122.2,18.5 122.3,16.5 121.6,14.2 124,12.6 122.5,13.5 120.6,13.8 120,16',
    '122,10.5 123,11.8 125.5,12.5 125.8,10.2 123.5,9.3',
    '122,7 123.5,8.6 125.5,9.8 126.5,7.5 125.4,5.6 124,6.5',
    '109,1 110.3,1.8 111.5,2.8 113,3.2 114.5,4.8 116.8,7 119.2,5.2 117.8,4 119,1 117.5,0.5 116.8,-1.3 116,-4 114.5,-3.5 111.7,-3.4 110.2,-2.8 109.3,-0.5',
    '95.3,5.6 97.5,5.2 100.5,2 104,-1.2 106,-3.2 105.9,-5.8 104.5,-5.8 102.3,-4 100.3,-1 98.7,1.7 96.5,3.7',
    '105.2,-6.8 106.8,-6 108.6,-6.7 110.7,-6.4 112.7,-7 114.5,-7.7 114.4,-8.7 111,-8.3 108,-7.8',
    '115,-8 119,-8.2 123,-8.2 127,-8.3 125,-10.2 119,-9.6 115.2,-8.8',
    '119,-3.5 119.8,1 125,1.6 124,0.3 121.2,0.3 121,-1 123,-1 122.8,-4.8 121.5,-4.8 120.4,-5.6 119.5,-5.5',
    '131,-0.8 134,-0.7 135.5,-3.3 137.8,-1.5 141,-2.6 144.5,-3.8 146,-5.5 147.8,-6.7 150.8,-10.6 147.2,-9.5 144,-7.8 142.5,-9.2 141,-9.1 139,-8 138,-8.4 138.8,-6.8 135.5,-4.5 133,-4 132,-2.8',
    // Australia, Tasmania, New Zealand
    '142.5,-10.7 143.5,-14 145.3,-15.5 146,-17 146.8,-19.3 149.3,-21.2 150.8,-23.2 153,-25.5 153.2,-27.5 153.6,-28.7 151.3,-33.9 150,-37.2 149.9,-37.5 146.4,-39.1 144.9,-38 143.5,-38.8 140.8,-38 139.7,-36 138.5,-35 137.8,-33 136,-35 135.6,-34.8 134,-32.8 131,-31.5 128.9,-31.7 124,-33 121.9,-33.9 118,-35 115.1,-34.4 115.8,-32 114.6,-28.8 113.5,-26 113.7,-24 114.1,-21.8 116.7,-20.6 118.6,-20.3 122.2,-18 123.5,-16.5 125.5,-14.3 127,-13.9 128.3,-14.9 129.5,-14.9 130.8,-12.4 132.5,-11.5 136.8,-12 135.8,-15 139.5,-17.6 141,-16 141.6,-12.6',
    '144.7,-40.8 148.3,-40.9 148,-43.2 146.5,-43.6 145.3,-42.5',
    '172.7,-34.4 174.3,-35.3 175.5,-36.5 178.5,-37.7 177,-39.5 175.3,-41.6 173.8,-39.3 174.7,-38 174.5,-36.5 173,-35',
    '172.7,-40.5 174.3,-41.5 172.8,-43.6 171,-45.5 169.5,-46.6 168,-46.6 166.5,-45.8 168.5,-44 171,-42.3 172.2,-40.8',
  ]
  // Cut out of the land: Black Sea, Sea of Azov, Caspian Sea, Great Lakes.
  const WATER = [
    '29,41.2 31.8,41.5 35.2,42 36.3,41.3 39.7,41 41.6,41.6 41,43 39.7,43.6 37.8,44.7 36.6,45.2 35.4,45 34.2,44.4 33.4,44.6 32.5,45.4 33.6,46.1 31,46.6 29.7,45.2 28.7,44.2 28,43.2 27.5,42.5 28,41.9',
    '35,45.4 36.6,45.4 38.2,46.2 39.3,47.1 37.5,47 35.2,46.4',
    '47,45 49.3,46.3 51.5,46.9 53,46.5 53,45.2 50.3,44.5 50.8,42.8 52.5,41.8 53,40 54,37 52,36.6 50,37.4 49,38.4 50,40.4 49.3,41.3 47.6,43',
    '-92,46.7 -88.5,48.8 -85,47.9 -84.6,46.5 -87,46.5 -90.5,46.6',
    '-87.8,41.7 -86.3,41.7 -85,45.5 -86,46 -87.9,44',
    '-84.5,46 -81.5,46.2 -80,44.5 -81.7,43 -83.5,43.8',
  ]

  // The four session nodes in the order the trading day reaches them. Hours
  // are typical session times in UTC; the bar is marked only 00 and 24.
  const CITIES = [
    { name: 'SYDNEY', lon: 151.2, lat: -33.9, open: 22, close: 31 },
    { name: 'TOKYO', lon: 139.7, lat: 35.7, open: 0, close: 9 },
    { name: 'LONDON', lon: -0.1, lat: 51.5, open: 8, close: 17 },
    { name: 'NEW YORK', lon: -74, lat: 40.7, open: 13, close: 22 },
  ]
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

  const COLLAPSE_AT = 4 - 9 / 30 // the last 8 frames
  const LAND_R = 2.2 // dot radii: land reads a little larger and brighter than sea
  const SEA_R = 1.6
  const wrap180 = d => ((((d + 180) % 360) + 360) % 360) - 180

  function makeLandTest() {
    const parse = list =>
      list.map(s => {
        const pts = s.split(' ').map(p => p.split(',').map(Number))
        const xs = pts.map(p => p[0])
        const ys = pts.map(p => p[1])
        return { pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
      })
    const land = parse(LAND)
    const water = parse(WATER)
    const inside = (poly, x, y) => {
      if (x < poly.x0 || x > poly.x1 || y < poly.y0 || y > poly.y1) return false
      let hit = false
      const p = poly.pts
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) hit = !hit
      }
      return hit
    }
    return (lon, lat) => {
      const a = wrap180(lon)
      for (const x of [a, a + 360]) {
        if (water.some(p => inside(p, x, lat))) return false
        if (land.some(p => inside(p, x, lat))) return true
      }
      return false
    }
  }

  /**
   * The longitude of the light band: it enters at the map's east edge (`start`)
   * and takes one servo step per beat, arriving on the beat, always westward.
   * The value keeps decreasing past -180 as the band laps the map.
   */
  function bandLon(t, start) {
    let from = start
    let lon = from
    for (let k = 0; k < 8; k++) {
      const to = CITIES[k % 4].lon - 360 * Math.floor(k / 4)
      const p = prog(t, 0.5 * (k + 1) - 0.4, 0.4, ease.cubic.inOut)
      if (p <= 0) break
      lon = lerp(from, to, p)
      from = to
    }
    return lon
  }

  AD.defineScene('always', {
    css: `
      .scene--always .k-headline .ln > span { will-change: auto; }
      .scene--always .aw-hour { position: absolute; font-size: var(--t-tag); line-height: 1; }
      .scene--always .aw-week { position: absolute; display: flex; }
      .scene--always .aw-day {
        flex: 1 1 0; display: grid; place-items: center; box-sizing: border-box; border-radius: 4px;
        font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.1em; line-height: 1; text-indent: 0.1em;
      }
    `,
    build(root, ctx) {
      const { W, H } = ctx
      const c = ctx.content
      const kit = AD.kit
      const css = getComputedStyle(document.documentElement)
      const token = name => css.getPropertyValue('--' + name).trim()
      const COL = { void: token('void'), hairline: token('hairline'), grey: token('grey'), white: token('white'), accent: token('accent') }
      const tagSize = parseFloat(token('t-tag'))

      // The flat line S05 opens on (falls back to mid-stage if 05-fan.js is absent).
      const lineY = AD.fanGeo ? AD.fanGeo(ctx).level : Math.round(c.y + c.h / 2)

      // Per-format composition. map.deg = degrees per dot; map.centre = central meridian;
      // labels: which side of its node each chip sits on (r, l, a(bove), b(elow)) and a vertical nudge.
      const L = ctx.pick({
        '16x9': {
          head: { x: c.x, y: c.y, w: 540 },
          map: { pitch: 8, deg: 2.5, centre: 20, top: 72, rows: 51, cols: 144, x: c.x + c.w - 1152, y: c.y + 2 },
          labels: { SYDNEY: ['r'], TOKYO: ['r'], LONDON: ['l', -9], 'NEW YORK': ['r', 9] },
          bar: { x: c.x, w: c.w, y: c.y + 512, rise: 46 },
          week: { x: c.x, w: c.w, y: c.y + 560, h: 58, gap: 8, font: 22 },
        },
        '9x16': {
          head: { x: c.x, y: c.y, w: c.w },
          map: { pitch: 8, deg: 8 / 3, centre: 40, top: 70, rows: 45, cols: 135, x: 0, y: c.y + 292, fade: 110 },
          labels: { SYDNEY: ['b'], TOKYO: ['a'], LONDON: ['l', -9], 'NEW YORK': ['r', 9] },
          bar: { x: c.x, w: 366, y: c.y + c.h - 10, rise: 30 },
          week: { x: c.x + 386, w: c.w - 386, y: c.y + c.h - 46, h: 46, gap: 4, font: 19 },
        },
        '4x5': {
          head: { x: c.x, y: c.y, w: c.w },
          map: { pitch: 8, deg: 8 / 3, centre: 14, top: 75, rows: 50, cols: 135, x: 0, y: c.y + 337, fade: 60 },
          labels: { SYDNEY: ['b'], TOKYO: ['a'], LONDON: ['l', -9], 'NEW YORK': ['r', 9] },
          bar: { x: c.x, w: c.w, y: c.y + 838, rise: 52 },
          week: { x: c.x, w: c.w, y: c.y + 890, h: 64, gap: 8, font: 22 },
        },
      })

      kit.grid(root)
      const g = AD.canvas(root).ctx

      // ── dot grid ──
      const M = L.map
      const ppd = M.pitch / M.deg
      const mapW = M.cols * M.pitch
      const mapH = M.rows * M.pitch
      const xMid = M.x + mapW / 2
      const xOf = lon => xMid + wrap180(lon - M.centre) * ppd
      const isLand = makeLandTest()
      const columns = []
      for (let j = 0; j < M.cols; j++) {
        const x = M.x + (j + 0.5) * M.pitch
        const lon = M.centre + (x - xMid) / ppd
        const land = []
        const sea = []
        for (let r = 0; r < M.rows; r++) {
          // Coverage of the cell by land, on a 3x3 sample.
          let n = 0
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (isLand(lon + ((a + 0.5) / 3 - 0.5) * M.deg, M.top - (r + (b + 0.5) / 3) * M.deg)) n++
          ;(n >= 4 ? land : sea).push(M.y + (r + 0.5) * M.pitch)
        }
        const path = (ys, radius) => {
          const p = new Path2D()
          for (const y of ys) {
            p.moveTo(x + radius, y)
            p.arc(x, y, radius, 0, Math.PI * 2)
          }
          return p
        }
        // Portrait formats bleed the map to the frame edge and let it dissolve there.
        const edge = M.fade ? AD.smoothstep(0, M.fade, Math.min(x, W - x)) : 1
        columns.push({ x, lon, land, sea, landPath: path(land, LAND_R), seaPath: path(sea, SEA_R), edge, order: 1 - j / (M.cols - 1) })
      }

      // ── session nodes and their labels ──
      const chipFont = `500 ${tagSize}px ${token('font-mono')}`
      const chipTrack = tagSize * 0.12
      g.font = chipFont
      g.letterSpacing = chipTrack.toFixed(2) + 'px'
      const nodes = CITIES.map((city, i) => {
        const j = clamp(Math.round((xOf(city.lon) - M.x) / M.pitch - 0.5), 0, M.cols - 1)
        const r = Math.round((M.top - city.lat) / M.deg - 0.5)
        const x = M.x + (j + 0.5) * M.pitch
        const y = M.y + (r + 0.5) * M.pitch
        // Label chip, painted on the canvas with the map (see render).
        const box = { width: Math.ceil(g.measureText(city.name).width - chipTrack) + 20, height: tagSize + 12 }
        const [side, nudge = 0] = L.labels[city.name]
        let left = side === 'r' ? x + 18 : side === 'l' ? x - 18 - box.width : x - box.width / 2
        const top = (side === 'a' ? y - 18 - box.height : side === 'b' ? y + 18 : y - box.height / 2) + nudge
        left = clamp(left, c.x, c.x + c.w - box.width)
        return { ...city, x, y, col: columns[j], chip: { x: Math.round(left), y: Math.round(top), w: box.width, h: box.height }, at: 0.5 * (i + 1) }
      })
      g.letterSpacing = '0px'

      // ── 24-hour bar: baseline, hour ticks, four session arcs ──
      const B = L.bar
      const hourPad = Math.round(tagSize * 1.9)
      const bx0 = B.x + hourPad
      const bx1 = B.x + B.w - hourPad
      const hx = h => bx0 + (h / 24) * (bx1 - bx0)
      const svg = AD.svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root)
      const clip = AD.svg('clipPath', { id: 'aw-clip' }, AD.svg('defs', null, svg))
      AD.svg('rect', { x: bx0, y: B.y - B.rise - 6, width: bx1 - bx0, height: B.rise + 8 }, clip)
      const base = AD.svg('path', { d: `M${bx0},${B.y + 0.5} L${bx1},${B.y + 0.5}`, stroke: COL.grey, 'stroke-width': 1, opacity: 0.7, fill: 'none', pathLength: 1, 'stroke-dasharray': '0 1' }, svg)
      let ticksD = ''
      for (let h = 0; h <= 24; h++) ticksD += `M${Math.round(hx(h)) + 0.5},${B.y + 1} l0,${h % 6 === 0 ? 10 : 5} `
      const ticks = AD.svg('path', { d: ticksD, stroke: COL.grey, 'stroke-width': 1, fill: 'none' }, svg)
      const arcs = CITIES.map(city => {
        const group = AD.svg('g', { 'clip-path': 'url(#aw-clip)' }, svg)
        const spans = city.close > 24 ? [[city.open, city.close], [city.open - 24, city.close - 24]] : [[city.open, city.close]]
        const parts = spans.map(([a, b]) => ({
          fill: AD.svg('path', { d: `M${hx(a)},${B.y} A${(hx(b) - hx(a)) / 2},${B.rise} 0 0 1 ${hx(b)},${B.y} Z`, fill: COL.accent, 'fill-opacity': 0, stroke: 'none' }, group),
          arc: AD.svg('path', { d: `M${hx(a)},${B.y} A${(hx(b) - hx(a)) / 2},${B.rise} 0 0 1 ${hx(b)},${B.y}`, fill: 'none', stroke: COL.accent, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '0 1' }, group),
          floor: AD.svg('path', { d: `M${hx(a)},${B.y} L${hx(b)},${B.y}`, fill: 'none', stroke: COL.accent, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '0 1' }, group),
        }))
        return { group, parts }
      })
      const hours = ['00', '24'].map((text, i) => {
        const node = el('div', 'aw-hour t-mono', root, text)
        const box = node.getBoundingClientRect()
        node.style.left = Math.round(i === 0 ? B.x : B.x + B.w - box.width) + 'px'
        node.style.top = Math.round(B.y - box.height / 2) + 'px'
        return node
      })

      // ── week strip ──
      const week = el('div', 'aw-week', root)
      week.style.cssText += `left:${L.week.x}px;top:${L.week.y}px;width:${L.week.w}px;height:${L.week.h}px;gap:${L.week.gap}px`
      const days = DAYS.map(name => {
        const cell = el('div', 'aw-day', week, name)
        cell.style.fontSize = L.week.font + 'px'
        return cell
      })

      const head = kit.headline(root, ['FOREX TRADES', '24 HOURS A DAY.', '5 DAYS A WEEK.'], { tier: 'display', ...L.head })

      // Fades are written as colour alpha, never element opacity: an element that has
      // been through an opacity fade is re-rastered with slightly different edges.
      const rgba = {}
      for (const name in COL) {
        const rgb = COL[name].replace('#', '').match(/../g).map(v => parseInt(v, 16)).join(',')
        rgba[name] = a => `rgba(${rgb},${clamp(a).toFixed(3)})`
      }
      return { g, COL, rgba, chipFont, chipTrack, M, mapW, mapH, xMid, ppd, columns, nodes, base, ticks, arcs, hours, days, head, lineY }
    },

    render(t, ctx, s) {
      const { W, H } = ctx
      const { g, COL, M, columns } = s
      const fall = clamp((t - COLLAPSE_AT) / (8 / 30 - 1e-4))
      const drop = ease.quart.in(fall) // 0 = map, 1 = flat line
      const east = M.centre + 180 // the map's east edge, where the band enters
      const lon = bandLon(t, east)
      const bandOn = prog(t, 0.1, 0.2) * (1 - prog(t, COLLAPSE_AT, 0.2))
      const mapTop = M.y - 6
      const mapBottom = M.y + s.mapH + 6

      g.clearRect(0, 0, W, H)

      // The band of light: sharp on its leading (west) side, long tail to the east.
      // Once it has left by the west edge it re-enters from the east (second term).
      const shape = d => Math.exp(-((d / (d < 0 ? 7 : 30)) ** 2))
      const glow = col => bandOn * Math.max(shape(col.lon - lon), lon + 360 <= east ? shape(col.lon - lon - 360) : 0)

      for (const col of columns) {
        const seen = prog(t, col.order * 0.26, 0.14) // right-to-left wave on the cut
        if (seen <= 0) continue
        const lit = glow(col)
        if (lit > 0.01 && drop === 0) {
          g.globalAlpha = 0.085 * lit * seen * col.edge
          g.fillStyle = COL.accent
          g.fillRect(col.x - M.pitch / 2, mapTop, M.pitch, mapBottom - mapTop)
        }
        let landPath = col.landPath
        let seaPath = col.seaPath
        if (drop > 0) {
          // Every dot falls to the line's height and thins to its weight.
          const dots = (ys, size) => {
            const p = new Path2D()
            const radius = lerp(size, 1, drop)
            for (const y of ys) {
              const yy = lerp(y, s.lineY + 1, drop)
              p.moveTo(col.x + radius, yy)
              p.arc(col.x, yy, radius, 0, Math.PI * 2)
            }
            return p
          }
          landPath = dots(col.land, LAND_R)
          seaPath = dots(col.sea, SEA_R)
        }
        g.globalAlpha = seen * (1 - fall)
        g.fillStyle = COL.hairline
        g.fill(seaPath)
        g.globalAlpha = seen * lerp(0.3, 1, col.edge)
        g.fillStyle = COL.grey
        g.fill(landPath)
        const tint = Math.max(lit, drop)
        if (tint > 0.01) {
          g.fillStyle = COL.accent
          g.globalAlpha = seen * tint * 0.32 * col.edge * (1 - fall)
          g.fill(seaPath)
          g.globalAlpha = seen * tint * lerp(0.3, 1, col.edge)
          g.fill(landPath)
        }
      }

      // Leading edge of the band, as a hairline (kept inside the map).
      for (const x of [s.xMid + (lon - M.centre) * s.ppd, s.xMid + (lon + 360 - M.centre) * s.ppd]) {
        if (x < M.x || x >= M.x + s.mapW || bandOn <= 0) continue
        g.globalAlpha = 0.6 * bandOn
        g.fillStyle = COL.accent
        g.fillRect(Math.round(x), mapTop, 1, mapBottom - mapTop)
      }

      // Session nodes: a ring that ignites when the band arrives, with a pulse on every arrival.
      const nodesOn = 1 - prog(t, COLLAPSE_AT, 0.2)
      s.nodes.forEach((node, i) => {
        const seen = prog(t, node.col.order * 0.26 + 0.06, 0.14) * nodesOn
        const lit = t >= node.at
        if (seen > 0) {
          g.globalAlpha = seen
          g.fillStyle = COL.void
          g.beginPath()
          g.arc(node.x, node.y, 13, 0, Math.PI * 2)
          g.fill()
          g.lineWidth = 2
          g.strokeStyle = lit ? COL.accent : COL.grey
          g.beginPath()
          g.arc(node.x, node.y, 9, 0, Math.PI * 2)
          g.stroke()
          g.fillStyle = lit ? COL.white : COL.grey
          g.beginPath()
          g.arc(node.x, node.y, 3.5, 0, Math.PI * 2)
          g.fill()
          // Pulses: when the band arrives (every 2 s) and when this session's arc starts.
          for (const at of [node.at, node.at + 2, 2 + i / 6]) {
            const p = (t - at) / 0.4
            if (p <= 0 || p >= 1) continue
            g.globalAlpha = seen * (1 - p) * 0.9
            g.strokeStyle = COL.accent
            g.beginPath()
            g.arc(node.x, node.y, 9 + p * 30, 0, Math.PI * 2)
            g.stroke()
          }
        }
        if (seen > 0) {
          const chip = node.chip
          g.beginPath()
          g.roundRect(chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1, 3)
          g.globalAlpha = seen * 0.9
          g.fillStyle = COL.void
          g.fill()
          g.globalAlpha = seen * (lit ? 0.55 : 1)
          g.lineWidth = 1
          g.strokeStyle = lit ? COL.accent : COL.hairline
          g.stroke()
          g.globalAlpha = seen
          g.fillStyle = lit ? COL.white : COL.grey
          g.font = s.chipFont
          g.letterSpacing = s.chipTrack.toFixed(2) + 'px'
          g.textBaseline = 'middle'
          g.fillText(node.name, chip.x + 10, chip.y + chip.h / 2 + 1)
          g.letterSpacing = '0px'
        }
      })

      // The collapsed map: one flat line across the frame, exactly where S05 picks it up.
      if (fall > 0) {
        const x0 = lerp(M.x, 0, drop)
        const x1 = lerp(M.x + s.mapW, W, drop)
        g.globalAlpha = drop
        g.fillStyle = COL.accent
        g.fillRect(x0, s.lineY, x1 - x0, 2)
      }
      g.globalAlpha = 1

      // 24-hour bar: the scale draws on with the map; the arcs fill it from the bar line at 8.0.
      s.base.setAttribute('stroke-dasharray', `${prog(t, 0.1, 0.4).toFixed(4)} 1`)
      s.ticks.setAttribute('opacity', (0.6 * prog(t, 0.2, 0.3)).toFixed(4))
      s.hours[0].style.color = s.rgba.grey(prog(t, 0.1, 0.15))
      s.hours[1].style.color = s.rgba.grey(prog(t, 0.4, 0.15))
      s.arcs.forEach((arc, i) => {
        const at = 2 + i / 6 // 5 frames apart
        const p = prog(t, at, 1 / 3)
        arc.group.style.display = p > 0 ? 'block' : 'none'
        for (const part of arc.parts) {
          part.arc.setAttribute('stroke-dasharray', `${p.toFixed(4)} 1`)
          part.floor.setAttribute('stroke-dasharray', `${p.toFixed(4)} 1`)
          part.fill.setAttribute('fill-opacity', (0.09 * prog(t, at + 0.2, 0.25)).toFixed(4))
        }
      })

      // Week strip: outlines arrive with the map; from 9.0 one cell lights every 3 frames.
      // The scan passes Saturday and Sunday and leaves them dark.
      s.days.forEach((cell, i) => {
        const seen = prog(t, 0.2 + i / 15, 0.15)
        const at = 3 + i * 0.1
        const open = i < 5
        const on = open && t >= at
        const tick = t >= at ? 1 - prog(t, at, 0.1) : 0 // one bright frame, then a settle
        cell.style.color = (on ? s.rgba.white : s.rgba.grey)(seen)
        cell.style.background = on ? s.rgba.accent(0.13 + 0.3 * tick) : 'transparent'
        cell.style.boxShadow = on ? `inset 0 0 0 2px ${COL.accent}` : `inset 0 0 0 1px ${(!open && tick > 0 ? s.rgba.grey : s.rgba.hairline)(seen)}`
      })

      s.head.show(t, { at: [-1 / 30, 2, 3] })
    },
  })
})()
