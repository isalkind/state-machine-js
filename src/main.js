'use strict';

var signals = require('signals');

/*
 * StateMachine
 */

function StateMachine() {
	this._states = {};
	this._initial = null;
	this._currentState = null;
	this._previousState = null;
	this._cancelled = null;
	this._transitionComplete = false;
	this._actionQueue = [];
	this._history = [];
	this._onChange = new signals.Signal();
	this._onEnter = new signals.Signal();
	this._onExit = new signals.Signal();
}

StateMachine.prototype = {
	start: function() {
		if ( !this._initial ) {
			throw 'State Machine cannot start. No states defined.';
		}
		this._transitionTo( this._initial, null );
    	return this;
	},
	action: function(action, data) {
		// Check if current action transition is complete
		if(!this._transitionComplete) {
			// Queue the new action and exit
			this._actionQueue.push({
				'action': action,
				'data': data
			});
			return this;
		}
		// Attempt to retrieve the new State
		var newStateTarget = this._currentState.getTarget( action );
		var newState = this._states[ newStateTarget ];
		// Only transition if there's a state associated with the action
		if( newState ) {
			this._transitionTo( newState, data, action );
		}
    	return this;
	},
	_transitionTo: function( nextState, data, action ) {
		this._transitionComplete = false;
		this._cancelled = false;

		// Exit current
		if ( this._currentState ) {
			// Dispatch specific Exit notification for current State
			this._currentState.onExit.dispatch(this._currentState, data, action);

			// Dispatch general Exit notification
			this._onExit.dispatch(this._currentState, data, action);
		}

		// Has transition been been cancelled on Exit guard?
		if ( this._cancelled ) {
			this._transitionComplete = true;
			this._cancelled = false;

			// Process action queue
			this._processActionQueue();
			return;
		}

		// Dispatch specific Enter notification for next State
		nextState.onEnter.dispatch(nextState, data, action);

		// Dispatch general Enter notification
		this._onEnter.dispatch(nextState, data, action);

		// Has transition been been cancelled on Enter guard?
		if ( this._cancelled ) {
			this._transitionComplete = true;
			this._cancelled = false;

			// Process action queue
			this._processActionQueue();
			return;
		}

		// Set previous state and save name in history array
		if(this._currentState) {
			this._previousState = this._currentState;
			this._history.push(this._previousState.name);
		}

		// Update current state now both guards have been passed
		this._currentState = nextState;

		// Dispatch specific Change notification for this State
		nextState.onChange.dispatch(this._currentState, data, action);

		// Dispatch general Change notification
		this._onChange.dispatch(this._currentState, data, action);

		// Set hasChanged flag to true
		this._transitionComplete = true;

		// Process action queue
		this._processActionQueue();
	},
	_processActionQueue: function() {
		if(this._actionQueue.length > 0) {
			var stateEvent = this._actionQueue.shift();

			// If currentState has no state for that action go to the next one
			if(!this._currentState.getTarget(stateEvent.action)) {
				this._processActionQueue();
			}
			else {
				this.action(stateEvent.action, stateEvent.data);
			}
		}
	},
	cancel: function() {
		this._cancelled = true;
    	return this;
	},
	_addState: function( state, isInitial ) {
		if ( state === null || this._states[ state.name ]) {
			return null;
		}
		this._states[ state.name ] = state;
		if ( isInitial ) {
			this._initial = state;
		}
		return state;
	},
	removeState: function( stateName ) {
		var state = this._states[ stateName ];
		if ( state === null ) {
			return null;
		}
		delete this._states[ stateName ];
    	return state;
	},
	getState: function(stateName) {
		return this._states[stateName];
	},
	create: function(config) {
		if(config instanceof Array) {
			config.forEach(function(item) {
				this.create(item);
			}, this);
			return this;
		}
		var state = new StateMachine.State(config.name);
		var transitions = config.transitions;
		if(transitions) {
			transitions.forEach(function(transition) {
				state.addTransition(transition.action, transition.target);
				if(typeof config.onChange === 'function') {
					state.onChange.add(config.onChange);
				}
				if(typeof config.onEnter === 'function') {
					state.onEnter.add(config.onEnter);
				}
				if(typeof config.onExit === 'function') {
					state.onExit.add(config.onExit);
				}
			});
		}
		var isInitial = this.getTotal() === 0 || config.initial;
    	this._addState(state, isInitial);
		return this;
	},
	getTotal: function() {
		return Object.keys(this.states).length;
	}
};

Object.defineProperty(StateMachine.prototype, 'onChange', {
	get: function() {
		return this._onChange;
	}
});

Object.defineProperty(StateMachine.prototype, 'onEnter', {
	get: function() {
		return this._onEnter;
	}
});

Object.defineProperty(StateMachine.prototype, 'onExit', {
	get: function() {
		return this._onExit;
	}
});

Object.defineProperty(StateMachine.prototype, 'currentState', {
	get: function() {
		return this._currentState;
	}
});

Object.defineProperty(StateMachine.prototype, 'previousState', {
	get: function() {
		return this._previousState;
	}
});

Object.defineProperty(StateMachine.prototype, 'states', {
	get: function() {
		return this._states;
	}
});

Object.defineProperty(StateMachine.prototype, 'initial', {
	get: function() {
		return this._initial;
	}
});

Object.defineProperty(StateMachine.prototype, 'history', {
	get: function() {
		return this._history;
	}
});

/*
 * State
 */

StateMachine.State = function(name) {
	this._transitions = {};
	this._name = name;
	this._onChange = new signals.Signal();
	this._onEnter = new signals.Signal();
	this._onExit = new signals.Signal();
};

StateMachine.State.prototype = {
	addTransition: function(action, target) {
		if ( this.getTarget( action ) ) {
			return;
		}
		this._transitions[ action ] = target;
	},
	removeTransition: function(action) {
		this._transitions[ action ] = null;
	},
	getTarget: function(action)	{
		return this._transitions[ action ];
	}
};

Object.defineProperty(StateMachine.State.prototype, 'name', {
	get: function() {
		return this._name;
	}
});

Object.defineProperty(StateMachine.State.prototype, 'transitions', {
	get: function() {
		return this._transitions;
	}
});

Object.defineProperty(StateMachine.State.prototype, 'onChange', {
	get: function() {
		return this._onChange;
	}
});

Object.defineProperty(StateMachine.State.prototype, 'onEnter', {
	get: function() {
		return this._onEnter;
	}
});

Object.defineProperty(StateMachine.State.prototype, 'onExit', {
	get: function() {
		return this._onExit;
	}
});

/*
 * Debug View
 */

StateMachine.DebugView = function(fsm) {

	var container = document.createElement('div');

	function updateState(name) {
		var all = container.querySelectorAll('div');
		for (var i = 0; i < all.length; i++) {
			all[i].style.display = all[i].getAttribute('data-state') === name ? 'block' : 'none';
		}
	}

	function createButton(action) {
		var btn = document.createElement('button');
		btn.setAttribute('data-action', action);
		btn.addEventListener('click', function() {
			var action = this.getAttribute('data-action');
			fsm.action(action);
		});
		btn.innerHTML = action;
		return btn;
	}

	Object.keys(fsm.states).forEach(function(key) {
		var state = fsm.states[key];
		var el = document.createElement('div');
		el.setAttribute('data-state', state.name);
		el.style.display = 'none';

		var name = document.createElement('h3');
		name.innerHTML = 'State: ' + state.name;
		el.appendChild(name);

		var transitions = state.transitions;
		if (transitions) {
			Object.keys(transitions).forEach(function(key) {
				if(transitions.hasOwnProperty(key)) {
					el.appendChild(createButton(key));
				}
			});
		}
		container.appendChild(el);
	});

	fsm.onChange.add(function(state) {
		updateState(state.name);
	});

	if(fsm.currentState) {
		updateState(fsm.currentState.name);
	}

	return container;
};

module.exports = StateMachine;
