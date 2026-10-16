import { useRef, useState } from 'preact/hooks';
import { Refusal, type Command } from '../shared/commands';
import type { NationStat, WarStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

export type GodToolId = 'revolt' | 'battle' | 'brush' | 'nuke';
const BUFFS = ['attack', 'defense', 'speed', 'income', 'manpower', 'unrest'] as const;
/** A granted buff: +25% (unrest: +2.5 a month) for 30 days. */
const BUFF_MAGNITUDE = 0.25;
const BUFF_HOURS = 24 * 30;
/** Why the sim did not carry out a command, in words (PLAN 2.17a). */
const REFUSAL_KEY: Record<Exclude<Refusal, 0>, MessageKey> = {
  [Refusal.NotANumber]: 'refusal.notANumber',
  [Refusal.NoNation]: 'refusal.noNation',
  [Refusal.DeadNation]: 'refusal.deadNation',
  [Refusal.SameNation]: 'refusal.sameNation',
  [Refusal.AtWar]: 'refusal.atWar',
  [Refusal.Truce]: 'refusal.truce',
  [Refusal.Subject]: 'refusal.subject',
  [Refusal.Allied]: 'refusal.allied',
  [Refusal.InAlliance]: 'refusal.inAlliance',
  [Refusal.NoAlliance]: 'refusal.noAlliance',
  [Refusal.NoSuch]: 'refusal.noSuch',
  [Refusal.NoEffect]: 'refusal.noEffect',
  [Refusal.LastNation]: 'refusal.lastNation',
  [Refusal.Alive]: 'refusal.alive',
  [Refusal.NoRevivals]: 'refusal.noRevivals',
  [Refusal.Cooldown]: 'refusal.cooldown',
  [Refusal.NoCoreLand]: 'refusal.noCoreLand',
  [Refusal.NoOtherName]: 'refusal.noOtherName',
  [Refusal.OnRetreat]: 'refusal.onRetreat',
  [Refusal.SameOverlord]: 'refusal.sameOverlord',
  [Refusal.AlliedRealm]: 'refusal.alliedRealm',
  [Refusal.AtSea]: 'refusal.atSea',
  [Refusal.Overrun]: 'refusal.overrun',
  [Refusal.NotOfLand]: 'refusal.notOfLand',
  [Refusal.NoNukes]: 'refusal.noNukes',
  [Refusal.NoWarhead]: 'refusal.noWarhead',
  [Refusal.NoDelivery]: 'refusal.noDelivery',
  [Refusal.OutOfRange]: 'refusal.outOfRange',
};

export interface GodTabProps {
  nation: NationStat;
  nations: NationStat[];
  wars: WarStat[];
  dead: { id: number; name: string }[];
  aiEnabled: boolean;
  /** The world's toggle of nuclear weapons (PLAN 6.1a). */
  nukesEnabled: boolean;
  tool: GodToolId | null;
  /** Why the last command sent was not carried out (`Refusal`; 0 = it was). */
  refusal: number;
  onCommand: (cmd: Command) => void;
  onTool: (tool: GodToolId) => void;
}

/**
 * God Mode tab of the nation panel (PLAN 1.32b): every God command of SPEC §9 on the selected
 * nation, plus map tools (revolt, breakthrough, territory brush) that take the next map clicks.
 * Kill asks for a second click instead of a browser dialog.
 */
export function GodTab({ nation, nations, wars, dead, aiEnabled, nukesEnabled, tool, refusal, onCommand, onTool }: GodTabProps) {
  const n = nation.id;
  const others = nations.filter((o) => o.id !== n).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  // The name typed and the armed Kill are this nation's (PLAN 2.17e3): each is kept with the
  // nation it was for, and is nothing on another nation's tab. The nation chosen below, the
  // buff and the nation to revive are the player's choice and stay.
  const [typed, setTyped] = useState({ nation: 0, name: '' });
  const name = typed.nation === n ? typed.name : '';
  const setName = (v: string) => setTyped({ nation: n, name: v });
  const [target, setTarget] = useState(0);
  const [buff, setBuff] = useState<(typeof BUFFS)[number]>('attack');
  const [revive, setRevive] = useState(0);
  const [armed, setArmed] = useState(0);
  /** The gold typed for the treasury (PLAN 7.4f15), this nation's only. */
  const [goldTyped, setGoldTyped] = useState({ nation: 0, value: '' });
  const goldText = goldTyped.nation === n ? goldTyped.value : '';
  /** The colour picked to recolour with, and the gold to donate (PLAN 7.4f16), this nation's only. */
  const [colorPicked, setColorPicked] = useState({ nation: 0, value: '' });
  const colorText = colorPicked.nation === n ? colorPicked.value : `#${nation.color.toString(16).padStart(6, '0')}`;
  const [giftTyped, setGiftTyped] = useState({ nation: 0, value: '' });
  const giftText = giftTyped.nation === n ? giftTyped.value : '';
  // The fields themselves, read when the button is pressed: a click that comes before the render
  // of the last key typed sent nothing (the gate's run, under load).
  const goldField = useRef<HTMLInputElement>(null);
  const giftField = useRef<HTMLInputElement>(null);
  const colorField = useRef<HTMLInputElement>(null);
  const armKill = armed === n;
  const setArmKill = (on: boolean) => setArmed(on ? n : 0);
  const tgt = target !== 0 && others.some((o) => o.id === target) ? target : (others[0]?.id ?? 0);
  // The nation chosen while it is dead: one revived since is no longer in the list.
  const toRevive = dead.some((d) => d.id === revive) ? revive : (dead[0]?.id ?? 0);
  const myWars =wars.filter((w) => w.attackers.includes(n) || w.defenders.includes(n));
  const nameOf = (id: number): string => {
    const o = nations.find((x) => x.id === id);
    return o ? displayName(o.name) : `#${id}`;
  };
  const btn = (testid: string, label: string, onClick: () => void, active = false) => (
    <button type="button" class={active ? 'god-btn active' : 'god-btn'} data-testid={testid} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <section class="god-tab" data-testid="panel-god">
      {refusal !== 0 ? (
        <div class="panel-warn" data-testid="god-refusal" role="status">
          {t('refusal.lead')} {t(REFUSAL_KEY[refusal as Exclude<Refusal, 0>] ?? 'refusal.noEffect')}
        </div>
      ) : null}
      <div class="god-row">
        <input data-testid="god-rename-input" value={name} placeholder={displayName(nation.name)} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        {btn('god-rename', t('god.rename'), () => onCommand({ kind: 'renameNation', nation: n, name }))}
      </div>
      <div class="god-row">
        <span>{t('god.gold')}</span>
        <input ref={goldField} data-testid="god-gold-input" inputMode="numeric" value={goldText} placeholder={String(Math.round(nation.gold))} onInput={(e) => setGoldTyped({ nation: n, value: (e.currentTarget as HTMLInputElement).value })} />
        {btn('god-gold', t('god.set'), () => {
          const typedNow = goldField.current?.value ?? goldText;
          const v = Number(typedNow);
          if (typedNow.trim() !== '' && Number.isFinite(v)) onCommand({ kind: 'setGold', nation: n, value: v });
          setGoldTyped({ nation: n, value: '' });
        })}
      </div>
      <div class="god-row">
        <input ref={colorField} type="color" data-testid="god-color-input" aria-label={t('god.recolor')} value={colorText} onInput={(e) => setColorPicked({ nation: n, value: (e.currentTarget as HTMLInputElement).value })} />
        {btn('god-recolor', t('god.recolor'), () => onCommand({ kind: 'recolorNation', nation: n, color: parseInt((colorField.current?.value ?? colorText).slice(1), 16) }))}
      </div>
      <div class="god-row">
        <span>{t('panel.incomeBonus')}</span>
        {btn('god-bonus-down', '−10', () => onCommand({ kind: 'setIncomeBonus', nation: n, value: nation.incomeBonus - 10 }))}
        <span data-testid="god-bonus">{nation.incomeBonus}%</span>
        {btn('god-bonus-up', '+10', () => onCommand({ kind: 'setIncomeBonus', nation: n, value: nation.incomeBonus + 10 }))}
      </div>
      <div class="god-row">
        <span>{t('panel.efficiency')}</span>
        {btn('god-ce-down', '−10', () => onCommand({ kind: 'setEfficiency', nation: n, value: nation.efficiency - 0.1 }))}
        <span data-testid="god-ce">{Math.round(nation.efficiency * 100)}%</span>
        {btn('god-ce-up', '+10', () => onCommand({ kind: 'setEfficiency', nation: n, value: nation.efficiency + 0.1 }))}
        <label>
          <input type="checkbox" data-testid="god-ce-lock" checked={nation.ceLocked} onChange={(e) => onCommand({ kind: 'lockEfficiency', nation: n, locked: (e.currentTarget as HTMLInputElement).checked })} />
          {t('god.ceLock')}
        </label>
      </div>
      {nation.alliance ? (
        <div class="god-row">
          <span>{t('panel.unity')}</span>
          {btn('god-unity-down', '−10', () => onCommand({ kind: 'setUnity', alliance: nation.alliance!.id, value: nation.alliance!.unity - 10 }))}
          <span data-testid="god-unity">{Math.round(nation.alliance.unity)}</span>
          {btn('god-unity-up', '+10', () => onCommand({ kind: 'setUnity', alliance: nation.alliance!.id, value: nation.alliance!.unity + 10 }))}
        </div>
      ) : null}
      <label class="god-row">
        <input type="checkbox" data-testid="god-ai" checked={!nation.aiOff} onChange={(e) => onCommand({ kind: 'setAi', nation: n, enabled: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.nationAi')}
      </label>
      <label class="god-row">
        <input type="checkbox" data-testid="god-world-ai" checked={aiEnabled} onChange={(e) => onCommand({ kind: 'setSetting', key: 'aiEnabled', value: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.worldAi')}
      </label>
      <label class="god-row">
        <input type="checkbox" data-testid="god-nukes" checked={nation.nukesAllowed} onChange={(e) => onCommand({ kind: 'setNukes', nation: n, allowed: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.nationNukes')}
      </label>
      <div class="god-row">
        <span>{t('panel.warheads')}</span>
        <span data-testid="god-warheads">{nation.warheads}</span>
        {btn('god-grant-warhead', '+1', () => onCommand({ kind: 'grantWarheads', nation: n, count: 1 }))}
      </div>
      <label class="god-row">
        <input type="checkbox" data-testid="god-world-nukes" checked={nukesEnabled} onChange={(e) => onCommand({ kind: 'setSetting', key: 'nukesEnabled', value: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.worldNukes')}
      </label>

      <div class="panel-sub">{t('god.diplomacy')}</div>
      <div class="god-row">
        <select data-testid="god-target" value={tgt} onChange={(e) => setTarget(Number((e.currentTarget as HTMLSelectElement).value))}>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {displayName(o.name)}
            </option>
          ))}
        </select>
      </div>
      <div class="god-row">
        {btn('god-war', t('god.war'), () => onCommand({ kind: 'declareWar', attacker: n, defender: tgt }))}
        {btn('god-ally', t('god.ally'), () =>
          onCommand(nation.alliance ? { kind: 'joinAlliance', nation: tgt, alliance: nation.alliance.id } : { kind: 'createAlliance', leader: n, members: [tgt], nameKey: 'alliance.defensive' }),
        )}
        {btn('god-puppet', t('god.puppet'), () => onCommand({ kind: 'createPuppet', overlord: n, subject: tgt, autonomy: 50 }))}
        {nation.alliance ? btn('god-leave', t('god.leave'), () => onCommand({ kind: 'leaveAlliance', nation: n })) : null}
        {btn('god-annex', t('god.annex'), () => onCommand({ kind: 'annexNation', annexer: n, target: tgt }))}
      </div>
      <div class="god-row">
        <input ref={giftField} data-testid="god-donate-input" inputMode="numeric" value={giftText} placeholder={t('god.donateAmount')} onInput={(e) => setGiftTyped({ nation: n, value: (e.currentTarget as HTMLInputElement).value })} />
        {btn('god-donate', t('god.donate'), () => {
          const typedNow = giftField.current?.value ?? giftText;
          const v = Number(typedNow);
          if (typedNow.trim() !== '' && Number.isFinite(v) && v > 0) onCommand({ kind: 'donateGold', from: n, to: tgt, amount: v });
          setGiftTyped({ nation: n, value: '' });
        })}
      </div>
      {myWars.map((w) => (
        <div class="god-row" key={w.id}>
          <span class="god-war-name">
            {nameOf(w.attackers[0] ?? 0)} {'⚔'} {nameOf(w.defenders[0] ?? 0)}
          </span>
          {btn(`god-peace-${w.id}`, t('god.peace'), () => onCommand({ kind: 'forcePeace', war: w.id }))}
          {(() => {
            // Fight to the death (PLAN 7.4f15, AoC's "Fight to the Death"): this nation's side of the war.
            const side: 0 | 1 = w.attackers.includes(n) ? 0 : 1;
            const on = w.toDeath[side];
            return btn(`god-death-${w.id}`, t('god.toDeath'), () => onCommand({ kind: 'setWarFightToDeath', war: w.id, side, value: !on }), on);
          })()}
        </div>
      ))}

      <div class="panel-sub">{t('god.buffs')}</div>
      <div class="god-row">
        <select data-testid="god-buff-kind" value={buff} onChange={(e) => setBuff((e.currentTarget as HTMLSelectElement).value as (typeof BUFFS)[number])}>
          {BUFFS.map((b) => (
            <option key={b} value={b}>
              {t(`god.buff.${b}` as MessageKey)}
            </option>
          ))}
        </select>
        {btn('god-buff', t('god.grant'), () => onCommand({ kind: 'grantBuff', targetKind: 'nation', target: n, buff, magnitude: BUFF_MAGNITUDE, hours: BUFF_HOURS, nameKey: 'buff.god' }))}
      </div>

      <div class="panel-sub">{t('god.tools')}</div>
      <div class="god-row">
        {btn('god-tool-revolt', t('god.tool.revolt'), () => onTool('revolt'), tool === 'revolt')}
        {btn('god-tool-battle', t('god.tool.battle'), () => onTool('battle'), tool === 'battle')}
        {btn('god-tool-brush', t('god.tool.brush'), () => onTool('brush'), tool === 'brush')}
        {btn('god-tool-nuke', t('god.tool.nuke'), () => onTool('nuke'), tool === 'nuke')}
      </div>
      {tool ? <div class="panel-note" data-testid="god-tool-hint">{t(`god.hint.${tool}` as MessageKey)}</div> : null}

      {dead.length > 0 ? (
        <div class="god-row">
          <select data-testid="god-revive-target" value={toRevive} onChange={(e) => setRevive(Number((e.currentTarget as HTMLSelectElement).value))}>
            {dead.map((d) => (
              <option key={d.id} value={d.id}>
                {displayName(d.name)}
              </option>
            ))}
          </select>
          {btn('god-revive', t('god.revive'), () => onCommand({ kind: 'reviveNation', nation: toRevive }))}
        </div>
      ) : null}
      <div class="god-row">
        {btn('god-kill', armKill ? t('god.killConfirm') : t('god.kill'), () => {
          if (!armKill) return setArmKill(true);
          setArmKill(false);
          onCommand({ kind: 'collapseNation', nation: n });
        }, armKill)}
      </div>
    </section>
  );
}
