import type { AlarmController } from '../controller/AlarmController.js';
import { CodesTab } from './CodesTab.js';
import { PopupStack } from './PopupStack.js';
import { TestTab } from './TestTab.js';
import { el } from './dom.js';

type TabId = 'codes' | 'test';

/** Shell: the two tabs from the design doc, plus the pop up layer. */
export class App {
  constructor(host: HTMLElement, controller: AlarmController) {
    const popups = new PopupStack(host);
    const codesTab = new CodesTab(controller);
    const testTab = new TestTab(controller, popups);

    const buttons: Record<TabId, HTMLButtonElement> = {
      codes: tabButton('Codes & contacts', 'panel-codes'),
      test: tabButton('Test', 'panel-test'),
    };

    const nav = el('nav', { class: 'tabs', role: 'tablist' }, buttons.codes, buttons.test);
    const panels = el('div', { class: 'panels' }, codesTab.element, testTab.element);

    const select = (id: TabId): void => {
      for (const key of Object.keys(buttons) as TabId[]) {
        const active = key === id;
        buttons[key].classList.toggle('is-active', active);
        buttons[key].setAttribute('aria-selected', String(active));
      }
      codesTab.element.hidden = id !== 'codes';
      testTab.element.hidden = id !== 'test';
    };

    buttons.codes.addEventListener('click', () => select('codes'));
    buttons.test.addEventListener('click', () => select('test'));

    host.append(
      el('header', { class: 'app-head' }, el('h1', {}, 'Alarm account'), nav),
      panels,
    );

    // The alarm can trip while the codes tab is open; jump to the keypad.
    controller.on('stateChanged', ({ state }) => {
      if (state === 'tripped') select('test');
    });

    select('codes');
  }
}

function tabButton(label: string, controls: string): HTMLButtonElement {
  return el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-controls': controls }, label);
}
