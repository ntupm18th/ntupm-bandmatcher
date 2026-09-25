const CONTACTS = [
  { name: '蘇子茗', ig: '_susu_fufu' },
  { name: '簡劭丞', ig: 'ablueboyy' },
  { name: '梁芷瑜', ig: 'fish._.liang' },
]

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules">
      <h2 className="form-title">報名規則</h2>

      <h3 className="section-title">徵選方式</h3>
      <p>
        本次徵選共有兩個階段，分別為一驗和二驗，兩次驗團都會以現場徵選為主。又分為兩種形式進行徵選，分別是「主唱組」和「樂團組」。兩種方式都會錄取一定名額的表演組別，可以請大家依照自己的狀況報名。
      </p>
      <dl className="info">
        <dt>一驗</dt>
        <dd>10/17、10/18</dd>
        <dt>二驗</dt>
        <dd>11/7</dd>
      </dl>
      <div className="rules-pair">
        <div>
          <h4>主唱組</h4>
          <p>適用於想要表演但自己不會樂器／不認識樂手的大家。一驗徵選時會是以現場清唱的形式進行，若成功徵選上，則會由我們依需求為你安排樂手！並在二驗的時候一起搭配表演。</p>
        </div>
        <div>
          <h4>樂團組</h4>
          <p>適用於想要表演，同時你也找齊你的樂團成員了。一驗徵選時就請大家依照下列的徵選內容，以樂團的形式進行演出。</p>
        </div>
      </div>

      <h3 className="section-title">徵選內容</h3>
      <div className="rules-pair">
        <div>
          <h4>一驗</h4>
          <p>
            主唱組與樂團組皆以「一段主歌＋一段副歌」的現場演出為原則，時長不得小於 1 分 30 秒。若有兩位主唱或有合音，則需優先表演有兩位主唱同時開口的段落。整首歌可以完整的演奏完畢，但評分只會以一主一副為依據。
          </p>
          <p className="rules-example">
            例：某首歌的第一段主歌是只有男生唱，到第二段主歌才有女生進來合音，那徵選內容就必須包含「第二段主歌」。
          </p>
        </div>
        <div>
          <h4>二驗</h4>
          <p>主唱組和樂團組都必須要現場表演「整首歌」。</p>
        </div>
      </div>

      <h3 className="section-title">評分標準</h3>
      <div className="rules-pair">
        <div>
          <h4>主唱組</h4>
          <table className="score">
            <tbody>
              <tr>
                <td>音準</td>
                <td>40%</td>
              </tr>
              <tr>
                <td>節奏</td>
                <td>30%</td>
              </tr>
              <tr>
                <td>
                  表達
                  <small>台風、詮釋方式、歌曲適配度</small>
                </td>
                <td>30%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4>樂團組</h4>
          <table className="score">
            <tbody>
              <tr className="score-group">
                <td>Vocal</td>
                <td>45%</td>
              </tr>
              <tr>
                <td className="indent">音準</td>
                <td>15%</td>
              </tr>
              <tr>
                <td className="indent">節奏</td>
                <td>15%</td>
              </tr>
              <tr>
                <td className="indent">
                  表達
                  <small>台風、詮釋方式、歌曲適配度</small>
                </td>
                <td>15%</td>
              </tr>
              <tr className="score-group">
                <td>樂器</td>
                <td>55%</td>
              </tr>
              <tr>
                <td className="indent">準確度（彈對）</td>
                <td>25%</td>
              </tr>
              <tr>
                <td className="indent">節奏（速度、默契）</td>
                <td>20%</td>
              </tr>
              <tr>
                <td className="indent">樂器音色</td>
                <td>10%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="section-title">重要事項</h3>
      <ol className="rules-list">
        <li>表演者以社員優先，若有特殊需求請洽個團負。</li>
        <li>各組報名皆以「一首歌」為原則，若為組曲則總時長不得超過 7 分鐘。</li>
        <li>
          擔任「主唱」最多只能報名一組樂團組和一組主唱組。若擔任合音則不在此限，但有鑑於社員數量龐大，為了提供更多表演機會，我們也會將大家的上台組數作為參考的依據。
        </li>
        <li>不接受全部播放伴奏的表演形式，即每個人在之夜當天上台時都會需要有樂手進行伴奏。</li>
        <li>不接受純器樂演奏曲。</li>
        <li>不接受同一主唱同一首歌同時報名主唱組和樂團組。</li>
        <li>
          關於報名團數是否影響徵選，目前希望讓每個人都有機會演出，然而更重要的是「歌曲的完整度」。請各位不用擔心，好好準備表演都有機會選上！
        </li>
      </ol>

      <h3 className="section-title">個團負責人（IG）</h3>
      <ul className="rules-contacts">
        {CONTACTS.map((c) => (
          <li key={c.ig}>
            {c.name}{' '}
            <a href={`https://instagram.com/${c.ig}`} target="_blank" rel="noreferrer">
              @{c.ig}
            </a>
          </li>
        ))}
      </ul>

      <p className="rules-end">以上，祝大家一切順利！</p>

      <div className="form-actions">
        <button className="btn" onClick={onClose}>
          我看完了
        </button>
      </div>
    </div>
  )
}
