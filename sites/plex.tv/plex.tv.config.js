const axios = require('axios')
const dayjs = require('dayjs')

const API_ENDPOINT = 'https://epg.provider.plex.tv'

module.exports = {
  site: 'plex.tv',
  request: {
    headers: {
      'x-plex-provider-version': '5.1'
    }
  },
  url: function ({ channel, date }) {
    const [_, channelGridKey] = channel.site_id.split('-')

    return `${API_ENDPOINT}/grid?channelGridKey=${channelGridKey}&date=${date.format('YYYY-MM-DD')}`
  },
  parser({ content }) {
    const programs = []
    const items = parseItems(content)
    for (let item of items) {
      programs.push({
        title: item.title,
        description: item.summary,
        categories: parseCategories(item),
        icon: item.art,
        start: parseStart(item),
        stop: parseStop(item)
      })
    }

    return programs
  },
  async channels({ lang }) {
    const data = await axios
      .get(`${API_ENDPOINT}/lineups/plex/channels?X-Plex-Token=zb85PfdNQLmsry9kQLBR`)
      .then(r => r.data)
      .catch(console.error)

    return data.MediaContainer.Channel.map(c => {
      return {
        site_id: c.id,
        name: c.title
      }
    })
  }
}

function parseCategories(item) {
  return Array.isArray(item.Genre) ? item.Genre.map(g => g.tag) : []
}

function parseStart(item) {
  const media = item.Media.length ? item.Media[0] : null

  return media ? dayjs.unix(media.beginsAt) : null
}

function parseStop(item) {
  const media = item.Media.length ? item.Media[0] : null

  return media ? dayjs.unix(media.endsAt) : null
}

function parseItems(content) {
  const data = JSON.parse(content)
  if (!data || !data.MediaContainer || !Array.isArray(data.MediaContainer.Metadata)) return []

  return data.MediaContainer.Metadata
}
