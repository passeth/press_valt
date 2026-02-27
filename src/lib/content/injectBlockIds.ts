interface BlockWithId {
  block_id: string;
  order_index: number;
}

const BLOCK_TAG_PATTERN = /<(h[1-6]|p|blockquote|ul|ol|pre)(\s[^>]*?)?>/gi;

function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function injectBlockIds(
  renderedHtml: string,
  blocks: BlockWithId[]
): string {
  if (!renderedHtml || blocks.length === 0) {
    return renderedHtml;
  }

  const orderedBlocks = [...blocks]
    .filter((block) => Boolean(block?.block_id))
    .sort((a, b) => a.order_index - b.order_index);

  if (orderedBlocks.length === 0) {
    return renderedHtml;
  }

  let blockPointer = 0;

  return renderedHtml.replace(BLOCK_TAG_PATTERN, (fullTag, tagName, attrs = "") => {
    if (blockPointer >= orderedBlocks.length) {
      return fullTag;
    }

    if (/\sdata-block-id\s*=/.test(attrs)) {
      blockPointer += 1;
      return fullTag;
    }

    const blockId = orderedBlocks[blockPointer].block_id;
    blockPointer += 1;

    return `<${tagName}${attrs} data-block-id="${escapeAttributeValue(blockId)}">`;
  });
}
