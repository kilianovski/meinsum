import React from 'react';
interface TableOfContentsProps {
    texts: string[];
    selectedIndex?: number;
    onEntryClick: (index: number) => void;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ texts, selectedIndex, onEntryClick }) => (
    <ul style={{ listStyleType: 'none', padding: 0 }}>
        {texts.map((text, index) => (
            <li
                key={index}
                style={{
                    padding: '10px 15px',
                    cursor: 'pointer',
                    backgroundColor: selectedIndex === index ? '#ADD8E6' : 'transparent', // Light blue background for selected item
                    border: '1px solid #ddd',
                    borderTopWidth: index === 0 ? '1px' : '0',
                    fontWeight: selectedIndex === index ? 'bold' : 'normal'
                }}
                onClick={() => onEntryClick(index)}
            >
                {text}
            </li>
        ))}
    </ul>
);

export default TableOfContents;
