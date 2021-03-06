/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Mazenet from './components/mazenet';
import './index.css';

declare global {
    interface Window { Mazenet: any; }
}
window.Mazenet = window.Mazenet || {};

ReactDOM.render(
    <Mazenet/>,
    document.getElementById('root') as HTMLElement
);
