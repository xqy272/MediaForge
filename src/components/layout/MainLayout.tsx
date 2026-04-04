import React, { useState } from 'react';
import { Sidebar, type ToolKey } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
    children: (activeTool: ToolKey) => React.ReactNode;
    settingsContent?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, settingsContent }) => {
    const [activeTool, setActiveTool] = useState<ToolKey>('background-remover');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const handleToolChange = (tool: ToolKey) => {
        setActiveTool(tool);
        setShowSettings(false);
    };

    return (
        <div className="flex h-screen bg-background transition-theme">
            <Sidebar
                activeTool={activeTool}
                onToolChange={handleToolChange}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                showSettings={showSettings}
                onOpenSettings={() => setShowSettings(true)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header currentTool={activeTool} showSettings={showSettings} />

                <main className="flex-1 overflow-auto p-6">
                    {showSettings ? settingsContent : children(activeTool)}
                </main>
            </div>
        </div>
    );
};
