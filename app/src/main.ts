// Fonts are bundled (no Google Fonts at the booth): Inter for the TV UI, Playfair Display for the product labels.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/playfair-display/500-italic.css';
import './styles/base.css';
import './styles/scenes.css';
import './styles/hud.css';
import './styles/factory.css';
import './styles/factory-v2.css';

import mockData from '../../assets/mock/visitors.json';
import { config } from './config';
import { MockProvider } from './data/mock';
import { MAYA, type DataProvider } from './data/provider';
import { SearchProvider } from './data/search';
import { installHud } from './debug/hud';
import { FactoryLoop } from './factory/loop';
import { FactoryStage } from './factory/stage';
import { log } from './loop/log';
import { LOOP, Loop, repeatScene } from './loop/orchestrator';
import { Stage } from './stage';
import type { Visitor } from './types';

addEventListener('error', (e) => log('error', { where: 'window', msg: e.message }));
addEventListener('unhandledrejection', (e) => log('error', { where: 'promise', msg: String(e.reason) }));

async function boot() {
  await document.fonts.ready;
  const provider: DataProvider =
    config.provider === 'search' && config.searchUrl ? new SearchProvider(config.searchUrl, LOOP.fetchTimeoutSec) : new MockProvider();
  if (config.flow === 'factory') {
    installHud(`${provider.name} · factory`);
    log('boot', { provider: provider.name, flow: 'factory', speed: config.speed });
    await new FactoryLoop(new FactoryStage(document.getElementById('app')!), provider).run();
    return;
  }
  const stage = new Stage(document.getElementById('app')!);
  installHud(provider.name);
  log('boot', { provider: provider.name, scene: config.scene, speed: config.speed });

  if (config.scene) {
    const mocks = (mockData as { visitors: Visitor[] }).visitors;
    const v = config.visitor;
    const who = v === null ? MAYA : (mocks.find((m) => m.id === v) ?? mocks[Number(v)] ?? MAYA);
    await repeatScene(stage, config.scene, who);
  } else {
    await new Loop(stage, provider).run();
  }
}

void boot();
