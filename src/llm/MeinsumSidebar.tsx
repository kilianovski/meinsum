import s from './Sidebar.module.scss';
import React, { createContext, useContext, useState } from 'react';
import clsx from 'clsx';
import { useProgramState } from './Sidebar';
import { PhaseTimeline } from './PhaseTimeline';
import { Commentary } from './Commentary';
import { IProgramState } from './Program';
import { Popup, PopupPos } from '@/src/utils/Portal';
import { useSubscriptions } from '../utils/hooks';
import { EinsumDemoApp, IEinsumProgramState, IOutput as IViewOutput } from '@/src/app/meinsum/EinsumDemoApp';
import TableOfContents from './MeinsumMenu';
import { IEinsumMenuItem } from './MyProgram';

export const MeinsumSidebar: React.FC = () => {
    let progState = useProgramState();
    const {einsumStates, currentEinsumState} = progState;

    const {state, name} = einsumStates[currentEinsumState];
    console.log(state);
    // if (!progState) return <div></div>

    function handleStateChanged(newState: IEinsumProgramState) {
        const i = currentEinsumState;
        const newStates: IEinsumMenuItem[] = [...einsumStates.slice(0,i), {name, state:newState}, ...einsumStates.slice(i+1)]
        progState.einsumStates = newStates;
        progState.markDirty()
    }

    function handleEntryClick(i: number) {
        progState.currentEinsumState = i;
        progState.markDirty();
    }

    const texts = einsumStates.map(s => s.name)


    let menu = <>
        <div className={s.topSplit}>
            <div className={s.toc}>
            </div>
            {/* <div className={s.helpers}>
                <div className={s.camStats}>
                    (center, center) =
                </div>
                <div className={s.camStats}>
                    new {camera.center.toString(1)}, new {camera.angle.toString(1)}
                </div>
            </div> */}
        </div>
    </>;

    return <div className={s.walkthrough}>
        <div className={s.split}>

            <div className={s.timelineLeft}>
                {/* <PhaseTimeline /> */}
            </div>

            <div className={s.content}>
                {/* <div className={s.menuTopBar}>
                    <div className={s.menu} ref={setMenuButtonEl} onClick={() => setMenuVisible(a => !a)}>Menu &gt;</div>
                    {menuVisible && <Popup targetEl={menuButtonEl} placement={PopupPos.BottomLeft} className={s.mainMenu} closeBackdrop onClose={() => setMenuVisible(false)}>
                        {menu}
                    </Popup>}
                    <div onClick={() => stepModel()}>Step</div>
                </div> */}
                {/* <Commentary /> */}
                <TableOfContents texts={texts} selectedIndex={currentEinsumState} onEntryClick={handleEntryClick} />
            <EinsumDemoApp einsumProgramState={state} onStateChanged={handleStateChanged} />
            </div>

        </div>
    </div>;
};

