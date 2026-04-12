import { Panel } from './Layout';

export default function CategoryRail({ categories, selectedCategoryId, onSelect }) {
  return (
    <div className="rail">
      <Panel className="panel-soft deck-panel">
        <div className="panel-header">
          <div>
            <div className="section-title">帖子分类</div>
            <p className="small-copy">把分类当作导航来切换内容流，选中态会保持稳定，不需要横向滑动。</p>
          </div>
          <div className="feed-kicker">共 {categories.length + 1} 个入口</div>
        </div>
        <div className="category-list category-strip">
          <button
            className={`category-card ${selectedCategoryId === null ? 'active' : ''}`}
            onClick={() => onSelect(null)}
          >
            <div className="category-swatch" style={{ background: '#1b1712' }} />
            <div className="category-card-head">
              <strong>全部帖子</strong>
              <span className="category-card-count">总览</span>
            </div>
            <div className="small-copy">查看全站公开帖子，适合快速浏览最新动态。</div>
            <div className="meta-copy">所有分类汇总</div>
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              className={`category-card ${selectedCategoryId === category.id ? 'active' : ''}`}
              onClick={() => onSelect(category.id)}
            >
              <div className="category-swatch" style={{ background: category.accentColor }} />
              <div className="category-card-head">
                <strong>{category.name}</strong>
                <span className="category-card-count">{category.visiblePostCount}</span>
              </div>
              <div className="small-copy">{category.description}</div>
              <div className="meta-copy">{category.visiblePostCount} 篇公开帖子</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
