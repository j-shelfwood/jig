// Quartz layout for the docs/ part of the website. site/build.sh copies this file over the one in the
// pinned Quartz checkout.
import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      Home: "https://j-shelfwood.github.io/agent-setup-blueprint/",
      GitHub: "https://github.com/j-shelfwood/agent-setup-blueprint",
    },
  }),
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [{ Component: Component.Search(), grow: true }, { Component: Component.Darkmode() }],
    }),
    Component.Explorer({
      // Reading order, not alphabetical. Self-contained: Quartz serialises this function with toString().
      sortFn: (a, b) => {
        const order = ["method", "architecture", "prompting-strategies", "orchestration", "install"]
        const ia = order.indexOf(a.slugSegment)
        const ib = order.indexOf(b.slugSegment)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      },
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [{ Component: Component.Search(), grow: true }, { Component: Component.Darkmode() }],
    }),
    Component.Explorer({
      // Reading order, not alphabetical. Self-contained: Quartz serialises this function with toString().
      sortFn: (a, b) => {
        const order = ["method", "architecture", "prompting-strategies", "orchestration", "install"]
        const ia = order.indexOf(a.slugSegment)
        const ib = order.indexOf(b.slugSegment)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      },
    }),
  ],
  right: [],
}
