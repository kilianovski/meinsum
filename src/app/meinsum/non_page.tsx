'use client';
import React from 'react';
import { LayerView } from '@/src/llm/LayerView';
import { InfoButton } from '@/src/llm/WelcomePopup';
// import { OperandItem } from './OperandItem';
import EinsumInputManager from './EinsumInputManager'; // Import the child component
import {EinsumDemoApp} from './EinsumDemoApp';

import { Header } from '../page';

interface IOperandItem {
    name: string,
    shape: number[] | null
    shapeString: string
}







export default function Page() {
    return <>
        <Header title="meinsum">
            <InfoButton />
        </Header>
        <h1>Hello meinsum!</h1>
        <EinsumDemoApp />
        <div id="portal-container"></div>
    </>;
}
