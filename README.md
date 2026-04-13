# **Built with Tailwind CSS**

![Logo](/logo-with-text.png)

**Built with Tailwind CSS** is a browser extension that enhances your development workflow by identifying the usage of Tailwind CSS on any webpage. This tool is designed for web developers, designers, and enthusiasts who want to understand how Tailwind CSS is implemented across various sites.

**Features:**

⚡ **Automatic Detection**: Discover instantly if a website is using Tailwind CSS as soon as you navigate to it. The extension analyses both external stylesheets and inline styles.

⚡ **Version Identification**: Not only does the extension detect the presence of Tailwind CSS, but it also determines the specific version used, helping you understand which features and utilities are likely employed.

⚡ **Badge Display**: A badge on the extension icon provides quick information about the detected Tailwind CSS version, or it remains blank if Tailwind CSS isn’t found.

⚡ **Efficient Caching**: Results are cached per domain to optimize performance and minimize redundant checks, ensuring swift browsing without repetitive processing.

⚡ **Easy Access**: Use the popup to get a summary of the detection results and access settings to customize the extension's behavior.

⚡ **Theme Support**: Toggle between light and dark themes for the extension’s popup window, aligning with your preferred visual style.

## How It Works

The Extension scans a web page's CSS for keywords and patterns associated with Tailwind CSS, including `tailwindcss`, `https://tailwindcss.com`, `--tw-`, and `tw-`.

## Firefox Support

Firefox packaging uses `src/manifest.firefox.json` (MV2 with `background.scripts`) for compatibility.

### Build Firefox package

```bash
./scripts/package-firefox.sh
```

Output:

- `build/built-with-tailwind-css-firefox-<version>.zip`

### Temporary Firefox install

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `src/manifest.firefox.json` (or extracted Firefox package `manifest.json`)

### AMO reviewer/policy notes

- Data collection permissions are declared as `none` in Gecko settings.
- Required permissions are limited to extension function (`tabs`, `storage`, `alarms`, `<all_urls>`).
- No third-party tracking or user account data collection.

## Releases

A single tag push creates one GitHub release with two assets:

- `build/built-with-tailwind-css-<version>.zip` (Chrome)
- `build/built-with-tailwind-css-firefox-<version>.zip` (Firefox)

## Contributions

Contributions are welcome! Feel free to submit pull requests with any enhancements or fixes. Here are some suggestions for contributions:

- Improve the documentation
- Design a new logo
- Propose novel methods for detecting Tailwind CSS usage
- And much more!

## Get Involved

GitHub Repository: [https://github.com/dankore/built-with-tailwind-css](https://github.com/dankore/built-with-tailwind-css)

Documentation: [https://dankore.github.io/built-with-tailwind-css](https://dankore.github.io/built-with-tailwind-css)

**Privacy & Security:**

Your privacy is paramount. **Built with Tailwind CSS** operates entirely locally, with no data sent over the Internet or stored on external servers. The extension does not track your browsing activity or access any data other than CSS class information.

**Permissions:**

- **Read and Change Data on Websites**: Necessary for detecting Tailwind CSS in styles applied to the web pages you visit.
- **Alarms**: Used for managing periodic cache resets.
- **Tabs & Scripting**: Essential for executing content scripts that check for Tailwind CSS and communicating with tabs.

**What's New:**

- Enhanced detection algorithms for pinpoint accuracy.
- Added support for latest Tailwind CSS versions.
- Improved performance with optimized caching mechanism.
- Updated UI for the popup with theme toggle support.
