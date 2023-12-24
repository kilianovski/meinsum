import React from 'react';
import { LayerView } from '@/src/llm/LayerView';
import { InfoButton } from '@/src/llm/WelcomePopup';
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// export const metadata = {
//   title: 'einsum visualization',
//   description: 'Sandbox for visualizing einsum. Includes pseudocode generation and 3d visualization of shapes of a given einsum program.',
// };

export const Header: React.FC<{
    title: React.ReactNode;
    children?: React.ReactNode;
}> = ({ title, children }) => {

    return <div className="flex justify-between items-center px-2 py-1 bg-blue-950 text-white h-[2.5rem] flex-shrink-0">

        <div className="flex items-center">{children}

        <div className="p-2">
            <a href="https://github.com/mishakeyvalue/mastering-einsum" rel="noopener noreferrer" target="_blank">
                <FontAwesomeIcon icon={faGithub} />
            </a>
        </div>

        <div className="p-2">
            <a href="https://twitter.com/mishakeyvalue" rel="noopener noreferrer" target="_blank">
                <FontAwesomeIcon icon={faTwitter} />
            </a>
        </div>

        </div>
        {title && <div className="text-2xl">{title}</div>}

        <div className="hover:underline">
        <div>
        <a href='https://github.com/bbycroft/llm-viz'>
            <div>
                llm-vis
            </div>
        </a>
        </div>
        </div>
    </div>;

};

export default function Page() {
    return <>
        <Header title="einsum visualization">

        </Header>

        <LayerView />
        <div id="portal-container"></div>
    </>;
}
