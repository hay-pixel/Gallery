const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("node:fs");
const path = require("node:path");

// CSS interop 0.2.1 seeds native cache files but omits web.css. Create it
// before Metro's initial crawl so a cold static export can hash the file.
const cssCache = path.join(
  path.dirname(require.resolve("react-native-css-interop/package.json")),
  ".cache",
);
fs.mkdirSync(cssCache, { recursive: true });
const webCss = path.join(cssCache, "web.css");
if (!fs.existsSync(webCss)) fs.writeFileSync(webCss, "");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
