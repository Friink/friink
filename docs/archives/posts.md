# Posts, Replies, Quotes, and Conversations

This document records the agreed product contract for post content and its
conversation behavior. It extends the existing implementation model without
changing the meaning of `kind`, `parent_post_id`, or `quoted_post_id`.

## Content types

Friink stores normal posts, replies, and Quotes in the same `posts` table.

- A normal post has `kind = post`, with no parent or quoted-post reference.
- A reply has `kind = reply` and a required `parent_post_id`.
- A Quote has `kind = quote` and a required `quoted_post_id`.

A reply is still a complete content object: it has its own author, ID, URL,
visibility, reactions, and descendants. It is not second-class content merely
because it participates in a conversation.

## Main feed

The main feed contains:

- Normal posts.
- Quote posts.

Standalone replies do not appear as independent feed items. A reply may appear
inside the feed only when it has been used as the referenced content in a Quote;
the feed item in that case is the user's Quote, not the original reply.

This prevents contextless replies from becoming orphaned feed items while still
allowing a reply to be shared as a deliberate authored contribution.

## Reply conversations

The original post is the conversation hub. Its replies are displayed as a
threaded tree rather than as one flat list.

- Top-level replies appear directly below the root post.
- A reply may have replies of its own.
- Child replies remain attached to their true parent.
- Branches may be collapsed and expanded independently.
- Large branches should load progressively with controls such as `View replies`.
- Reply order is chronological within each branch unless a later product
  decision introduces an explicit alternate ordering mode.

## Nesting and presentation

Logical nesting is not limited by the presentation layer. The UI must not keep
adding horizontal indentation indefinitely.

- The first three levels use progressive indentation.
- A subtle vertical connector rail communicates branch membership.
- Visual indentation is capped after level three.
- Deeper replies reuse the capped indentation and show parent context such as
  `Replying to @username`.
- A deep branch may expose `View replies` or `Open thread` rather than rendering
  every descendant immediately.

When a reply is opened in focused thread view, display depth is relative to the
selected reply. For example, opening a level-13 reply makes it local level 0;
its level-14 and level-15 children display as local levels 1 and 2. The actual
ancestor chain remains available as compact, navigable context above the
selected reply.

## Reply pages and permalinks

Every reply may be opened and shared through its own canonical URL.

A reply permalink opens a focused conversation view containing:

- Compact context for the root and relevant ancestors.
- The selected reply, visually highlighted.
- Direct replies to the selected reply.
- A `View full conversation` action returning to the root conversation.

Opening a reply does not turn it into a normal feed post. It remains a reply in
profiles, feeds, notifications, and all server-side visibility decisions.

## Reactions

Every visible normal post, reply, and Quote may be liked or saved.

- Likes and Saves apply to the individual content object being acted on.
- Reply Likes and Saves do not affect the root post's counts.
- Reply reaction notifications go to the reply author under the normal
  notification rules.
- A reply's own page uses the same reaction behavior as its threaded row.

The previous top-level-post-only reaction restriction is not part of the
agreed contract.

## Visibility and unavailable content

The existing server-side visibility rules apply equally to roots, replies,
ancestors, descendants, and Quotes.

- Private content is visible only where the viewer is authorized.
- Blocked, deleted, or otherwise inaccessible content must not be exposed by a
  reply or Quote endpoint.
- A nested response must not reveal a hidden ancestor through metadata or
  surrounding context.
- If a referenced parent or quoted original becomes unavailable, the UI may
  preserve the conversation position with a neutral unavailable placeholder,
  but must not reveal the protected content.

Reply creation must continue to recheck that the selected parent is visible to
the author at submission time.

## Quotes

A Quote is a new authored post that embeds a reference to another visible post
or reply. It is not a reply to the referenced content.

- The Quote belongs to the person who created it.
- It appears in that person's profile and in eligible feeds.
- It has its own Likes, Saves, Replies, and Quote count.
- The embedded original is an attributed, linked preview.
- Replies to the Quote belong to the Quote conversation.
- The original author is not implicitly added to replies on the Quote.
- The outer Quote owns the action bar; the embedded original is navigational
  context and does not show a competing action bar.
- Quote text may remain optional when the referenced content is present, in
  accordance with the existing composer rule.
- Quote-of-Quote chains may exist, but visual rendering should show only one
  embedded reference layer and offer a `View original` action beyond it.

If the original becomes unavailable, the Quote remains an authored post with a
neutral unavailable reference card and no leaked original content.

## Out of scope for this contract

- Reintroducing standalone replies into the main feed.
- A separate ranking system for replies.
- A hard product-level nesting limit.
- Reactions on the embedded original directly from inside a Quote card.
- Automatic notification of the root author for every reply to a nested branch.

The detailed interaction and visual contract belongs in
`packages/design/design.md` when the threaded UI is implemented.
