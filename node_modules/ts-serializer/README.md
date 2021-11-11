<h1 align="center"> TS Serializer</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/dpopescu/ts-serializer" target="_blank">
    <img src="https://img.shields.io/npm/dt/ts-serializer.svg" alt="npm" />
  </a>
  <a href="https://travis-ci.org/dpopescu/ts-serializer.svg?branch=master" target="_blank">
    <img src="https://travis-ci.org/dpopescu/ts-serializer.svg" alt="license" />
  </a>
  <a href="https://github.com/dpopescu/ts-serializer/stargazers" target="_blank">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/dpopescu/ts-serializer.svg?style=social" alt="stars">
  </a>
</p>

<br />

> **TS Serializer** provides `TypeScript` decorators to help developers with serializing/deserializing TypeScript classes into and from JSON objects.

## Installation

### Using npm:

`npm install --save ts-serializer`

## Usage

You can find a [codesandbox playground here](https://codesandbox.io/s/ts-serializer-playground-gdbid)!

### TypeScript

#### Deserialization:

```TypeScript
import {Serialize, SerializeProperty, Serializable} from 'ts-serializer';

@Serialize({})
class MyClass extends Serializable {
    @SerializeProperty({
        map: 'username'
    })
    public name:string;
}

let instance:MyClass = new MyClass();

console.log(instance.name); // Prints `undefined`

instance.deserialize({
    username: 'Some Value'
});

console.log(instance.name); // Prints 'Some Value'
```

---

#### Serialization:

```TypeScript
import {Serialize, SerializeProperty, Serializable} from 'ts-serializer';

@Serialize({})
class MyClass extends Serializable {
    @SerializeProperty({
        map: 'username'
    })
    public name:string;
}

let instance:MyClass = new MyClass();
instance.name = 'Some Value';

console.log(instance.serialize()); // Prints {username:'Some Value'}
```

### JavaScript

> **Note:** Although the library was designed to be used as a decorator in TypeScript, it doesn't matter that it can't be used in plain old JavaScript. The syntax can be a little messy but the result is the same.

#### Deserialization:

```JavaScript
var Serialize = TSerializer.Serialize;
var SerializeProperty = TSerializer.SerializeProperty;

function MyClass(){
    this.name;
}

Serialize({})(MyClass);
SerializeProperty({
   map: 'username'
})(MyClass.prototype, 'name');

var instance = new MyClass();

console.log(instance.name); // Prints `undefined`

instance.deserialize({
    username: 'Some Value'
});

console.log(instance.name); // Prints 'Some Value'
```

---

#### Serialization:

```JavaScript
var Serialize = TSerializer.Serialize;
var SerializeProperty = TSerializer.SerializeProperty;

function MyClass(){
    this.name = 'Some Value';
}

Serialize({})(MyClass);
SerializeProperty({
   map: 'username'
})(MyClass.prototype, 'name');

var instance = new MyClass();

console.log(instance.serialize()); // Prints {username:'Some Value'}
```

## Library Options

The library allows you to pass different serialization/deserialization options both on class level and on property level.

### Class Options

#### root

When you want to deserialize just a child object from the JSON you can use the `root` option.

```TypeScript
@Serialize({
    root: 'childObject'
})
class MyClass extends Serializable {
    @SerializeProperty({})
    public name:string;
}

let instance:MyClass = new MyClass();
instance.deserialize({
    childObject: {
        name: 'Some Value'
    }
});

console.log(instance.name); // Prints 'Some Value'
```

### Property Options

#### root

The `root` option can also be used on a property.

> **Note:** If `root` is already specified at class level the value is inherited to all class properties. If you want to override this, you can use hte `.` value. In this case, the property will be mapped up one level.

```TypeScript
@Serialize({})
class MyClass extends Serializable {
    @SerializeProperty({
        root: 'childObject'
    })
    public name:string;
}

let instance:MyClass = new MyClass();
instance.deserialize({
    childObject: {
        name: 'Some Value'
    }
});

console.log(instance.name); // Prints 'Some Value'
```

---

#### map

When the property name in the JSON doesn't match with your class properties, the `map` option can be used. This option maps a property from the JSON with a different property from your class.

```TypeScript
@Serialize({})
class MyClass extends Serializable {
    @SerializeProperty({
        map: 'username'
    })
    public name:string;
}

let instance:MyClass = new MyClass();
instance.deserialize({
    username: 'Some Value'
});

console.log(instance.name); // Prints 'Some Value'
```

---

#### list

The `list` option can be used when the JSON property value is a list of items.

```TypeScript
@Serialize({})
class MyClass extends Serializable {
    @SerializeProperty({
        list: true
    })
    public items:string[];
}

let instance:MyClass = new MyClass();
instance.deserialize({
    items: ['a', 'b', 'c']
});

console.log(instance.items); // Prints ['a', 'b', 'c']
```

---

#### type

When you want to use non-primitive types for deserialization use the `type` option.

> **Note:** The `type` object should also be a `Serializable` object.

```TypeScript
@Serialize({})
class User extends Serializable {
    @SerializeProperty({})
    public firstName:string;
    @SerializeProperty({})
    public lastName:string;
}

@Serialize({})
class Profile extends Serializable {
    @SerializeProperty({
        type: User
    })
    public user:User;
}

let instance:Profile = new Profile();
instance.deserialize({
    user: {
        firstName: 'John',
        lastName: 'Doe'
    }
});

console.log(instance.user.firstName); // Prints 'John'
console.log(instance.user.lastName); // Prints 'Doe'
```

#### optional

The `optional` option can be used when the property or the value may not exist.

```TypeScript
@Serialize({})
class User extends Serializable {
    @SerializeProperty({})
    public name:string;
    @SerializeProperty({
        optional: true
    })
    public age:number;
}

@Serialize({})
class Profile extends Serializable {
    @SerializeProperty({
        type: User
    })
    public user:User;
}

let instance:Profile = new Profile();
instance.deserialize({
    user: {
        firstName: 'John',
    }
});

console.log(instance.user.firstName); // Prints 'John'
console.log(instance.user.age); // Prints 'null'
```

# Contribute

You can help improving this project sending PRs and helping with issues.
