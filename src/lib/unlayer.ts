// Re-exports of @unlayer/react-image-editor's own types, verified against
// @unlayer/react-image-editor@1.0.2 (node_modules/@unlayer/react-image-editor/dist/index.d.ts).
// If a package bump breaks this file, diff that .d.ts against the shapes below.
export type { ImageEditorRef, ImageEditorInstance, ImageEditorSaveResult as SaveResult } from '@unlayer/react-image-editor';

import type { ImageEditorOptions } from '@unlayer/react-image-editor';

/** The subset of ImageEditorOptions this app actually passes to the editor. */
export type EditorOptions = Pick<ImageEditorOptions, 'theme' | 'locale' | 'translations' | 'features'>;
