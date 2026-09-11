import { useMemo, useRef } from 'react';
import ImageEditor from '@unlayer/react-image-editor';
import type { EditorOptions, ImageEditorRef } from '../lib/unlayer';

interface Props {
  image: string;
}

/**
 * Locked "intake scan" -- a second, independent `<ImageEditor>` instance
 * mounted beside the working editor, every tool disabled, always showing the
 * suspect's untouched source portrait. A viewer, not an editor: the player
 * always has the original on screen to compare the plate they're doctoring
 * against.
 *
 * A second simultaneous instance, not a second render of the same one: its
 * own `editorId`, its own ref, and its own memoized `options` object --
 * sharing either with the working editor's is undefined behaviour, not just
 * untidy code (see the unlayer-editor skill).
 */
export function ReferencePlate({ image }: Props) {
  const ref = useRef<ImageEditorRef>(null);

  const options = useMemo(
    () =>
      ({
        theme: 'dark' as const,
        locale: 'en',
        features: {
          imageEditor: {
            tools: {
              crop: false,
              resize: false,
              filter: false,
              draw: false,
              text: false,
              shapes: false,
              stickers: false,
              frame: false,
            },
          },
        },
      }) satisfies EditorOptions,
    [],
  );

  return (
    <ImageEditor
      ref={ref}
      editorId="reference"
      image={image}
      minHeight={560}
      style={{ height: '100%' }}
      options={options}
    />
  );
}
