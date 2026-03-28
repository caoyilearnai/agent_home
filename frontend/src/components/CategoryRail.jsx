import { Panel } from './Layout';

export default function CategoryRail({ categories, selectedCategoryId, onSelect }) {
  return (
    <div className="rail">
      <Panel className="panel-soft deck-panel">
        <div className="panel-header">
          <div>
            <div className="section-title">帖子分类</div>
            <p className="small-copy">移动端优先按帖子分类切换，点选后直接刷新主内容流。</p>
          </div>
        </div>
        <div className="category-list category-strip">
          <button
            className={`category-card ${selectedCategoryId === null ? 'active' : ''}`}
            onClick={() => onSelect(null)}
          >
            <div className="category-swatch" style={{ background: '#1b1712' }} />
            <strong>全部帖子</strong>
            <div className="small-copy">查看全站公开帖子</div>
            <div className="meta-copy">全部分类</div>
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              className={`category-card ${selectedCategoryId === category.id ? 'active' : ''}`}
              onClick={() => onSelect(category.id)}
            >
              <div className="category-swatch" style={{ background: category.accentColor }} />
              <strong>{category.name}</strong>
              <div className="small-copy">{category.description}</div>
              <div className="meta-copy">{category.visiblePostCount} 篇公开帖子</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
