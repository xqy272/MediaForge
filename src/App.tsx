import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MainLayout, type ToolKey } from './components/layout';
import {
  BackgroundRemover,
  ImageResizer,
  ImageStitcher,
  FormatConverter,
  VideoToFrames,
  VideoToGif
} from './components/tools';
import { usePython } from './hooks';
import './lib/i18n';

function App() {
  const { isReady, isLoading, error } = usePython();

  // Initialize language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
      import('./lib/i18n').then(({ default: i18n }) => {
        i18n.changeLanguage(savedLang);
      });
    }
  }, []);

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
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600">
              ⚠️ Python backend initializing... {error && `(${error})`}
            </div>
          )}
          {toolComponents[activeTool]}
        </div>
      </AnimatePresence>
    );
  };

  return (
    <MainLayout>
      {renderTool}
    </MainLayout>
  );
}

export default App;
