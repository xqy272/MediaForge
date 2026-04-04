import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { MainLayout, Settings, type ToolKey } from './components/layout';
import { usePython } from './hooks';
import './lib/i18n';

const BackgroundRemover = lazy(() =>
  import('./components/tools/BackgroundRemover').then(m => ({ default: m.BackgroundRemover }))
);
const ImageResizer = lazy(() =>
  import('./components/tools/ImageResizer').then(m => ({ default: m.ImageResizer }))
);
const ImageStitcher = lazy(() =>
  import('./components/tools/ImageStitcher').then(m => ({ default: m.ImageStitcher }))
);
const FormatConverter = lazy(() =>
  import('./components/tools/FormatConverter').then(m => ({ default: m.FormatConverter }))
);
const VideoToFrames = lazy(() =>
  import('./components/tools/VideoToFrames').then(m => ({ default: m.VideoToFrames }))
);
const VideoToGif = lazy(() =>
  import('./components/tools/VideoToGif').then(m => ({ default: m.VideoToGif }))
);

function App() {
  const { t } = useTranslation();
  const { isReady, isLoading, error, retry } = usePython();

  const renderTool = (activeTool: ToolKey) => {
    const toolComponents: Record<ToolKey, React.ReactNode> = {
      'background-remover': <BackgroundRemover />,
      'image-resizer': <ImageResizer />,
      'image-stitcher': <ImageStitcher />,
      'format-converter': <FormatConverter />,
      'video-to-frames': <VideoToFrames />,
      'video-to-gif': <VideoToGif />,
    };

    return (
      <AnimatePresence mode="wait">
        <div key={activeTool}>
          {/* Python status indicator */}
          {!isReady && !isLoading && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600 flex items-center justify-between">
              <span>⚠️ {t('python_status.initializing')} {error && `(${error})`}</span>
              <button
                onClick={retry}
                className="ml-3 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-yellow-700 font-medium transition-colors"
              >
                {t('python_status.retry')}
              </button>
            </div>
          )}
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }>
            {toolComponents[activeTool]}
          </Suspense>
        </div>
      </AnimatePresence>
    );
  };

  return (
    <MainLayout settingsContent={<Settings />}>
      {renderTool}
    </MainLayout>
  );
}

export default App;
