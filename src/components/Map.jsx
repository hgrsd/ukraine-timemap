import React from 'react';
import { Portal } from 'react-portal';

import { connect } from 'react-redux'
import * as selectors from '../selectors'

import hash from 'object-hash';
import 'leaflet';

import { isNotNullNorUndefined } from '../js/utilities';

import MapSites from './MapSites.jsx';
import MapShapes from './MapShapes.jsx';
import MapEvents from './MapEvents.jsx';
import MapSelectedEvents from './MapSelectedEvents.jsx';
import MapNarratives from './MapNarratives.jsx';
import MapDefsMarkers from './MapDefsMarkers.jsx';

class Map extends React.Component {

  constructor() {
    super();
    this.svgRef = React.createRef();
    this.map = null;
    this.state = {
      mapTransformX: 0,
      mapTransformY: 0
    }
    this.styleLocation = this.styleLocation.bind(this)
  }

  componentDidMount(){
    if (this.map === null) {
      this.initializeMap();
    }
  }

  componentWillReceiveProps(nextProps) {
    // Set appropriate zoom for narrative
    if (hash(nextProps.app.mapBounds) !== hash(this.props.app.mapBounds)
      && nextProps.app.mapBounds !== null) {
        this.map.fitBounds(nextProps.app.mapBounds);
    } else {
      if (hash(nextProps.app.selected) !== hash(this.props.app.selected)) {
        // Fly to first  of events selected
        const eventPoint = (nextProps.app.selected.length > 0) ? nextProps.app.selected[0] : null;

        if (eventPoint !== null && eventPoint.latitude && eventPoint.longitude) {
          this.map.setView([eventPoint.latitude, eventPoint.longitude]);
        }
      }
    }
  }

  initializeMap() {
    /**
     * Creates a Leaflet map and a tilelayer for the map background
     */
    const map =
      L.map(this.props.ui.dom.map)
        .setView(this.props.app.mapAnchor, 14)
        .setMinZoom(7)
        .setMaxZoom(18)
        .setMaxBounds([[180, -180], [-180, 180]])

    let s;
    if (process.env.MAPBOX_TOKEN && process.env.MAPBOX_TOKEN !== 'your_token') {
      s = L.tileLayer(
        `http://a.tiles.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${process.env.MAPBOX_TOKEN}`
      );
    } else {
      // eslint-disable-next-line
      alert(`No mapbox token specified in config.
            Timemap does not currently support any other tiling layer,
            so you will need to sign up for one at:

            https://www.mapbox.com/

            Stop and start the development process in terminal after you have added your token to config.js`
        )
        return
    }
    s = s.addTo(map);

    map.keyboard.disable();

    map.on('move zoomend viewreset moveend', () => this.alignLayers());
    map.on('zoomstart', () => { if (this.svgRef.current !== null) this.svgRef.current.classList.add('hide') });
    map.on('zoomend', () => { if (this.svgRef.current !== null) this.svgRef.current.classList.remove('hide'); });
    window.addEventListener('resize', () => { this.alignLayers(); });

    this.map = map;
  }

  alignLayers() {
    const mapNode = document.querySelector('.leaflet-map-pane');
    if (mapNode === null) return { transformX: 0, transformY: 0 };

    // We'll get the transform of the leaflet container,
    // which will let us offset the SVG by the same quantity
    const transform = window
      .getComputedStyle(mapNode)
      .getPropertyValue('transform');

    // Offset with leaflet map transform boundaries
    this.setState({
      mapTransformX: +transform.split(',')[4],
      mapTransformY: +transform.split(',')[5].split(')')[0]
    })
  }

  getClientDims() {
    const boundingClient = document.querySelector(`#${this.props.ui.dom.map}`).getBoundingClientRect();

    return {
      width: boundingClient.width,
      height: boundingClient.height
    }
  }

  renderTiles() {
    const pane = this.map.getPanes().overlayPane;
    const { width, height } = this.getClientDims();

    return (
      <Portal node={pane}>
        <svg
          ref={this.svgRef}
          width={width}
          height={height}
          style={{ transform: `translate3d(${-this.state.mapTransformX}px, ${-this.state.mapTransformY}px, 0)`}}
          className='leaflet-svg'
        >
        </svg>
      </Portal>
    );
  }

  renderSites() {
    return (
      <MapSites
        sites={this.props.domain.sites}
        map={this.map}
        mapTransformX={this.state.mapTransformX}
        mapTransformY={this.state.mapTransformY}
        isEnabled={this.props.app.views.sites}
      />
    );
  }

  renderShapes() {
    return (
      <MapShapes
        shapes={this.props.domain.shapes}
        map={this.map}
        mapTransformX={this.state.mapTransformX}
        mapTransformY={this.state.mapTransformY}
      />
    )
  }

  renderNarratives() {
    return (
      <MapNarratives
        svg={this.svgRef.current}
        narratives={this.props.domain.narratives}
        map={this.map}
        mapTransformX={this.state.mapTransformX}
        mapTransformY={this.state.mapTransformY}
        narrative={this.props.app.narrative}
        narrativeProps={this.props.ui.narratives}
        onSelect={this.props.methods.onSelect}
        onSelectNarrative={this.props.methods.onSelectNarrative}
      />
    );
  }

  /**
   * Determines additional styles on the <circle> for each location.
   * A location consists of an array of events (see selectors). The function
   * also has full access to the domain and redux state to derive values if
   * necessary. The function should return an array, where the value at the
   * first index is a styles object for the SVG at the location, and the value
   * at the second index is an optional function that renders additional
   * components in the <g/> div.
   */
  styleLocation(location) {
    const noEvents = location.events.length
    return [
      null,
      () => noEvents > 1 ? <text className='location-count' dx='-3' dy='4'>{noEvents}</text> : null
    ]
  }

  renderEvents() {
    return (
      <MapEvents
        svg={this.svgRef.current}
        locations={this.props.domain.locations}
        styleLocation={this.styleLocation}
        categories={this.props.domain.categories}
        map={this.map}
        mapTransformX={this.state.mapTransformX}
        mapTransformY={this.state.mapTransformY}
        narrative={this.props.app.narrative}
        onSelect={this.props.methods.onSelect}
        onSelectNarrative={this.props.methods.onSelectNarrative}
        getCategoryColor={this.props.methods.getCategoryColor}
      />
    );
  }

  renderSelected() {
    return (
      <MapSelectedEvents
        svg={this.svgRef.current}
        selected={this.props.app.selected}
        map={this.map}
        mapTransformX={this.state.mapTransformX}
        mapTransformY={this.state.mapTransformY}
      />
    );
  }


  renderMarkers() {
    return (
      <Portal node={this.svgRef.current}>
        <MapDefsMarkers />
      </Portal>
    )
  }


  render() {
    const { isShowingSites } = this.props.app.flags
    const classes = this.props.app.narrative ? 'map-wrapper narrative-mode' : 'map-wrapper';
    const innerMap = !!this.map ? (
      <React.Fragment>
        {this.renderTiles()}
        {this.renderMarkers()}
        {isShowingSites ? this.renderSites() : null}
        {this.renderShapes()}
        {this.renderEvents()}
        {this.renderNarratives()}
        {this.renderSelected()}
      </React.Fragment>
    ) : null

    return (
      <div className={classes}>
        <div id={this.props.ui.dom.map} />
        {innerMap}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    domain: {
      locations: selectors.selectLocations(state),
      narratives: selectors.selectNarratives(state),
      categories: selectors.selectCategories(state),
      sites: selectors.getSites(state),
      shapes: selectors.getShapes(state)
    },
    app: {
      views: state.app.filters.views,
      selected: state.app.selected,
      highlighted: state.app.highlighted,
      mapAnchor: state.app.mapAnchor,
      mapBounds: state.app.filters.mapBounds,
      narrative: state.app.narrative,
      flags: {
        isShowingSites: state.app.flags.isShowingSites
      }
    },
    ui: {
      dom: state.ui.dom,
      narratives: state.ui.style.narratives
    }
  }
}

export default connect(mapStateToProps)(Map)

