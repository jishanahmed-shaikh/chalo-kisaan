/**
 * Simple markdown-like formatting utility
 * Converts markdown syntax to React components without external dependencies
 */

export function parseMarkdown(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines but track them
    if (!trimmed) {
      elements.push({ type: 'br', key: `br-${i}` });
      i++;
      continue;
    }

    // Headings (# ## ###)
    if (trimmed.match(/^#{1,6}\s+/)) {
      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#+\s+/, '');
      elements.push({
        type: 'heading',
        level,
        key: `h${i}`,
        content: parseInline(content),
      });
      i++;
      continue;
    }

    // Unordered lists (- * •)
    if (trimmed.match(/^[-*•]\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].trim().match(/^[-*•]\s+/)) {
        const itemText = lines[i].trim().replace(/^[-*•]\s+/, '');
        listItems.push(parseInline(itemText));
        i++;
      }
      elements.push({
        type: 'ul',
        key: `ul-${i}`,
        items: listItems,
      });
      continue;
    }

    // Ordered lists (1. 2. 3.)
    if (trimmed.match(/^\d+\.\s+/)) {
      const listItems = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        listItems.push(parseInline(itemText));
        i++;
      }
      elements.push({
        type: 'ol',
        key: `ol-${i}`,
        items: listItems,
      });
      continue;
    }

    // Paragraphs
    elements.push({
      type: 'p',
      key: `p-${i}`,
      content: parseInline(trimmed),
    });
    i++;
  }

  return elements;
}

/**
 * Parse inline formatting: **bold**, *italic*, `code`, [link](url)
 */
export function parseInline(text) {
  const parts = [];
  let i = 0;

  while (i < text.length) {
    // Bold **text**
    if (text[i] === '*' && text[i + 1] === '*') {
      const closeIdx = text.indexOf('**', i + 2);
      if (closeIdx > i + 2) {
        parts.push({
          type: 'strong',
          text: text.substring(i + 2, closeIdx),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // Italic *text* (but not ** or ***)
    if (text[i] === '*' && text[i + 1] !== '*' && text[i - 1] !== '*') {
      const closeIdx = text.indexOf('*', i + 1);
      if (closeIdx > i + 1 && text[closeIdx - 1] !== '*') {
        parts.push({
          type: 'em',
          text: text.substring(i + 1, closeIdx),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // Code `text`
    if (text[i] === '`') {
      const closeIdx = text.indexOf('`', i + 1);
      if (closeIdx > i + 1) {
        parts.push({
          type: 'code',
          text: text.substring(i + 1, closeIdx),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // Links [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i);
      if (closeBracket > i && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket);
        if (closeParen > closeBracket) {
          const linkText = text.substring(i + 1, closeBracket);
          const url = text.substring(closeBracket + 2, closeParen);
          parts.push({
            type: 'link',
            text: linkText,
            url,
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Regular text
    let nextSpecial = text.length;
    for (let j = i + 1; j < text.length; j++) {
      if ('*`['.includes(text[j])) {
        nextSpecial = j;
        break;
      }
    }
    if (nextSpecial > i) {
      parts.push({
        type: 'text',
        text: text.substring(i, nextSpecial),
      });
      i = nextSpecial;
    } else {
      parts.push({
        type: 'text',
        text: text.substring(i),
      });
      break;
    }
  }

  return parts;
}

/**
 * Render a list of inline parts to JSX-like objects
 */
export function renderInline(parts) {
  if (!parts) return '';
  if (typeof parts === 'string') return parts;

  return parts.map((part, idx) => {
    switch (part.type) {
      case 'strong':
        return <strong key={`strong-${idx}`}>{part.text}</strong>;
      case 'em':
        return <em key={`em-${idx}`}>{part.text}</em>;
      case 'code':
        return (
          <code key={`code-${idx}`} className="va__inline-code">
            {part.text}
          </code>
        );
      case 'link':
        return (
          <a
            key={`link-${idx}`}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="va__link"
          >
            {part.text}
          </a>
        );
      case 'text':
      default:
        return part.text;
    }
  });
}

/**
 * Main function to render markdown to JSX
 */
export function renderMarkdown(text) {
  if (!text) return null;

  const elements = parseMarkdown(text);

  return elements.map((element) => {
    switch (element.type) {
      case 'br':
        return <br key={element.key} />;

      case 'heading':
        const HeadingTag = `h${Math.min(element.level, 6)}`;
        return (
          <HeadingTag key={element.key} className={`va__markdown-h${element.level}`}>
            {renderInline(element.content)}
          </HeadingTag>
        );

      case 'ul':
        return (
          <ul key={element.key} className="va__markdown-ul">
            {element.items.map((item, idx) => (
              <li key={`li-${idx}`}>{renderInline(item)}</li>
            ))}
          </ul>
        );

      case 'ol':
        return (
          <ol key={element.key} className="va__markdown-ol">
            {element.items.map((item, idx) => (
              <li key={`li-${idx}`}>{renderInline(item)}</li>
            ))}
          </ol>
        );

      case 'p':
      default:
        return (
          <p key={element.key} className="va__markdown-p">
            {renderInline(element.content)}
          </p>
        );
    }
  });
}
