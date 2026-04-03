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
              <span>⚠️ Python backend initializing... {error && `(${error})`}</span>
              <button
                onClick={retry}
                className="ml-3 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-yellow-700 font-medium transition-colors"
              >
                Retry
              </button>
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
