// Quartz configuration for the docs/ part of the website. site/build.sh copies this file over the one in
// the pinned Quartz checkout, so imports resolve from there.
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "agent-setup-blueprint",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    // GitHub Pages project site; the docs live one level below the landing page.
    baseUrl: "j-shelfwood.github.io/agent-setup-blueprint/docs",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      // "local" loads no web fonts; names that are not installed fall through to Quartz's system font stack.
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "system-ui",
        body: "system-ui",
        code: "ui-monospace",
      },
      colors: {
        lightMode: {
          light: "#fcfcfb",
          lightgray: "#e4e4e2",
          gray: "#a3a3a0",
          darkgray: "#3f3f3d",
          dark: "#1f1f1e",
          secondary: "#2f5d7c",
          tertiary: "#5f8a7e",
          highlight: "rgba(47, 93, 124, 0.08)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#151517",
          lightgray: "#2f2f33",
          gray: "#6b6b70",
          darkgray: "#d2d2d4",
          dark: "#ececee",
          secondary: "#8db4cf",
          tertiary: "#7fae9f",
          highlight: "rgba(141, 180, 207, 0.12)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.SyntaxHighlighting({
        theme: { light: "github-light", dark: "github-dark" },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false, mermaid: true, callouts: true, wikilinks: true }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: true, enableRSS: true }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
